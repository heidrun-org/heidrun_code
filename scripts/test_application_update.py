"""Build and serve two local Heidrun Code Development versions for update review."""

import argparse
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
import tempfile
import time


REPOSITORY = Path(__file__).resolve().parent.parent
DESKTOP = REPOSITORY / "packages/apps/desktop_tauri"
ARTIFACTS = DESKTOP / "target/update-test"
BUNDLE_NAME = "Heidrun Code Development.app"
DEVELOPMENT_IDENTIFIER = "dev.heidrun-org.heidrun-code.development"
OLD_VERSION = "0.4.0"
NEW_VERSION = "0.4.1"


def verified_bundle(path, version):
    """Return the executable only after checking the development identity and version."""
    info = json.loads(subprocess.check_output(
        ["/usr/bin/plutil", "-convert", "json", "-o", "-", path / "Contents/Info.plist"]
    ))
    if info["CFBundleIdentifier"] != DEVELOPMENT_IDENTIFIER:
        raise ValueError(f"Unexpected application identifier in {path}")
    if info["CFBundleShortVersionString"] != version:
        raise ValueError(f"Expected version {version} in {path}")
    executable_name = info["CFBundleExecutable"]
    if executable_name != Path(executable_name).name:
        raise ValueError(f"Invalid executable name in {path}")
    return path / "Contents/MacOS" / executable_name


def build():
    """Build both versions and cache their application bundle and disk image."""
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="build-", dir=ARTIFACTS) as staging_path:
        staging = Path(staging_path)
        for version in (OLD_VERSION, NEW_VERSION):
            print(f"Building {BUNDLE_NAME} {version}", flush=True)
            subprocess.run(
                ["pnpm", "build:development", "--config", json.dumps({"version": version})],
                cwd=REPOSITORY, check=True,
            )
            bundle = DESKTOP / "target/release/bundle/macos" / BUNDLE_NAME
            verified_bundle(bundle, version)
            destination = staging / version
            destination.mkdir()
            subprocess.run(["/usr/bin/ditto", bundle, destination / BUNDLE_NAME], check=True)
        image = staging / "update.dmg"
        subprocess.run(
            ["/usr/bin/hdiutil", "create", "-srcfolder", staging / NEW_VERSION, "-format", "UDZO", image],
            check=True,
        )
        previous = ARTIFACTS / BUNDLE_NAME
        if previous.exists():
            shutil.rmtree(previous)
        (staging / OLD_VERSION / BUNDLE_NAME).rename(previous)
        image.replace(ARTIFACTS / "update.dmg")
    print(f"Reusable test builds: {ARTIFACTS}", flush=True)


def run(scenario):
    """Start the same release protocol on loopback and open a fresh copy of the older version."""
    bundle = ARTIFACTS / BUNDLE_NAME
    image = ARTIFACTS / "update.dmg"
    machine = platform.machine()
    release_architecture = "aarch64" if machine == "arm64" else machine
    if not bundle.is_dir() or not image.is_file():
        build()
    verified_bundle(bundle, OLD_VERSION)
    with image.open("rb") as file:
        digest = hashlib.sha256()
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
        checksum = digest.hexdigest()
    trial = Path(tempfile.mkdtemp(prefix="heidrun-update-test-", dir="/private/tmp"))
    applications = trial / "Applications"
    applications.mkdir()
    installed = applications / BUNDLE_NAME
    subprocess.run(["/usr/bin/ditto", bundle, installed], check=True)
    executable = verified_bundle(installed, OLD_VERSION)

    class ReleaseHandler(BaseHTTPRequestHandler):
        def do_GET(self):
            if self.path == "/latest":
                if scenario == "check-failed":
                    self.send_error(503)
                    return
                release = {
                    "tag_name": f"v{OLD_VERSION if scenario == 'current' else NEW_VERSION}",
                    "assets": [{
                        "name": f"Heidrun_Code_{release_architecture}.dmg",
                        "digest": f"sha256:{checksum}",
                        "browser_download_url": f"http://127.0.0.1:{self.server.server_port}/update.dmg",
                    }],
                }
                body = json.dumps(release).encode()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            elif self.path == "/update.dmg":
                self.send_response(200)
                self.send_header("Content-Length", str(image.stat().st_size))
                self.end_headers()
                if scenario == "slow":
                    time.sleep(12)
                with image.open("rb") as file:
                    if scenario == "interrupted":
                        self.wfile.write(file.read(16384))
                    else:
                        shutil.copyfileobj(file, self.wfile)
            else:
                self.send_error(404)

    with ThreadingHTTPServer(("127.0.0.1", 0), ReleaseHandler) as server:
        print(f"Scenario: {scenario}")
        print(f"Application: {installed}")
        print(f"Update log: {trial / 'data/application_log.jsonl'}")
        print(f"Initial application output: {trial / 'startup.log'}")
        print("Leave this server running while you test. Quit the application before stopping the server.", flush=True)
        arguments = [executable, "--no-splash-screen", f"--update-test-port={server.server_port}"]
        if scenario == "automatic":
            arguments.append("--update-test-check-on-startup")
        with (trial / "startup.log").open("wb") as output:
            child = subprocess.Popen(
                arguments,
                cwd=trial, stdout=output, stderr=subprocess.STDOUT, start_new_session=True,
                env={**os.environ, "XDG_CONFIG_HOME": str(trial / "config")},
            )
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            if child.poll() is None:
                child.terminate()
                child.wait()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("build", help="Build and cache both development versions.")
    run_parser = commands.add_parser("run", help="Start a fresh trial with the cached builds.")
    run_parser.add_argument("--scenario", choices=["update", "automatic", "current", "check-failed", "interrupted", "slow"], default="update")
    arguments = parser.parse_args()
    if arguments.command == "build":
        build()
    else:
        run(arguments.scenario)


if __name__ == "__main__":
    main()
