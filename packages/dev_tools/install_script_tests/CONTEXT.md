# Directory Context: `/packages/dev_tools/install_script_tests`

## Purpose
A full npm package that holds the tests of the script `scripts/install.sh`, which installs the latest Heidrun Code in `/Applications` and links its command lines in a temporary user bin folder. The tests run the real script with fake commands.

## Key Exports & Entry Points
- `tests/install_script.test.ts`: the Vitest tests. They check the download, the mount, the copy, the eject, the deletion of the temporary folder, the installed version, and the message of each stop.
- `tests/install_script_runner.ts`: the class `InstallScriptRunner`, which creates a temporary folder and runs the script with fake commands. Only the tests import it.
- Command to test this folder: `pnpm --filter install_script_tests test`

## Rules
- The tests run the real file `scripts/install.sh` with `/bin/sh`. They never copy its text. Their app fixture includes executable command files in `Contents/Resources/binaries`.
- The tests replace `uname`, `pgrep`, `curl`, `hdiutil`, and `ditto` with fake commands in the first folder of `PATH`, and install in a temporary folder with the variable `HEIDRUN_CODE_APPLICATIONS_FOLDER`. A test never touches `/Applications` and never uses the network.
- The fake commands are written once for each process, in one folder that every runner shares. macOS checks each new executable file at its first run, and this cost about 780 milliseconds for each runner before ([issue 826](https://github.com/heidrun-org/heidrun/issues/826)).
- The tests do not check that the web address of the latest disk image works. That check needs a real release that has the file `Heidrun_aarch64.dmg`.
- No package in `packages/apps` imports this package.

## Background
- The package was created by [issue #515](https://github.com/heidrun-org/heidrun/issues/515).
