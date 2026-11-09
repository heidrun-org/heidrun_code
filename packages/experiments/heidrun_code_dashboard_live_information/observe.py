#!/usr/bin/env python3
"""Collect real local coding agent observations without controlling coding agents."""

import argparse
import json
import os
from pathlib import Path
import sys
import tempfile
import time
import uuid

from codex_reader import CodexReader


def claude_observations(folder, now_ms, stale_ms):
    sessions = []
    errors = []
    for path in sorted(folder.glob("*.json")):
        try:
            snapshot = None
            for attempt in range(3):
                try:
                    snapshot = json.loads(path.read_text())
                    break
                except (OSError, ValueError):
                    if attempt < 2:
                        time.sleep(0.02)
            if not isinstance(snapshot, dict) or snapshot.get("schemaVersion") != 1:
                raise ValueError("Missing or unsupported observation snapshot")
            if snapshot.get("codingAgent") != "claude":
                raise ValueError("Not a Claude Code observation")
            session_id = snapshot["sessionId"]
            if not isinstance(session_id, str) or path.stem != session_id:
                raise ValueError("Observation filename does not match its session identifier")
            observed_at = snapshot["observedAtMs"]
            if not isinstance(observed_at, (float, int)):
                raise ValueError("Observation has no numeric timestamp")
            stale = now_ms - observed_at > stale_ms or observed_at > now_ms + stale_ms
            snapshot["source"] = str(path)
            snapshot["isStale"] = stale
            requests = snapshot.get("pendingRequests", [])
            blocked = {request.get("agentId") for request in requests if isinstance(request, dict)}
            for agent in snapshot.get("agents", []):
                native = agent.get("status")
                agent["observedStatus"] = "unknown" if stale else "blocked" if agent.get("id") in blocked else native
                agent["statusSource"] = "stale" if stale else "pending_request" if agent.get("id") in blocked else "agent.list"
            sessions.append(snapshot)
        except (OSError, ValueError, KeyError, TypeError, AttributeError) as error:
            errors.append({"source": str(path), "error": str(error)})
    return sessions, errors


def codex_observations(reader, roots, maximum):
    sessions = []
    for root_id in roots:
        root = reader.request("thread/read", {"threadId": root_id})["thread"]
        children = []
        cursor = None
        while True:
            params = {
                "ancestorThreadId": root_id,
                "sourceKinds": ["subAgentThreadSpawn", "subAgent"],
                "limit": min(100, maximum - len(children)),
            }
            if cursor is not None:
                params["cursor"] = cursor
            page = reader.request("thread/list", params)
            children.extend(page["data"])
            cursor = page.get("nextCursor")
            if cursor is None or len(children) >= maximum:
                break
        observed = []
        messages = []
        activities = {}
        ids = {root_id, *(child["id"] for child in children)}
        for thread in [root, *children]:
            status = thread.get("status", {"type": "unknown"})
            flags = status.get("activeFlags", [])
            observed.append({
                "id": thread["id"],
                "parentId": thread.get("parentThreadId"),
                "name": thread.get("name"),
                "source": thread.get("source"),
                "nativeStatus": status,
                "observedStatus": "blocked" if any(flag in flags for flag in (
                    "waitingOnApproval", "waitingOnUserInput",
                )) else status.get("type", "unknown"),
            })
            # The latest page is bounded. This is a live overview, not a complete history export.
            page = reader.request("thread/items/list", {
                "threadId": thread["id"], "limit": 100, "sortDirection": "desc",
            })
            for entry in page["data"]:
                item = entry["item"]
                if item.get("type") == "subAgentActivity":
                    recipient = item.get("agentThreadId")
                    at_ms = item.get("completedAtMs") or 0
                    if at_ms >= activities.get(recipient, {}).get("atMs", -1):
                        activities[recipient] = {"kind": item.get("kind"), "atMs": at_ms}
                if item.get("type") == "subAgentActivity" and item.get("kind") == "interacted":
                    recipient = item.get("agentThreadId")
                    if recipient in ids:
                        messages.append({
                            "id": item["id"],
                            "senderId": thread["id"],
                            "recipientId": recipient,
                            "atMs": item.get("completedAtMs"),
                            "text": None,
                            "contentAvailability": "not_exposed",
                            "source": "subAgentActivity",
                        })
        for agent in observed:
            agent["lastActivity"] = activities.get(agent["id"])
        sessions.append({
            "codingAgent": "codex", "sessionId": root.get("sessionId", root_id),
            "rootThreadId": root_id, "cwd": root.get("cwd"), "isStale": False,
            "observedAtMs": int(time.time() * 1000), "agents": observed,
            "messages": messages, "childrenLimitReached": cursor is not None,
            "source": "shared_codex_server",
        })
    return sessions


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--claude-dir", type=Path, default=Path("/tmp/heidrun_code_dashboard_live"))
    parser.add_argument("--codex-root", action="append", default=[], help="Explicit root chat UUID; repeat for several roots")
    parser.add_argument("--codex-socket", type=Path, default=Path.home() / ".codex/app-server-control/app-server-control.sock")
    parser.add_argument("--stale-after", type=float, default=5)
    parser.add_argument("--interval", type=float, default=1)
    parser.add_argument("--max-children", type=int, default=100)
    parser.add_argument("--output", type=Path, help="Atomically replace this combined snapshot as observations arrive")
    parser.add_argument("--once", action="store_true")
    args = parser.parse_args()
    if args.interval < 0.25 or args.stale_after <= 0 or not 1 <= args.max_children <= 1000:
        parser.error("Use interval >= 0.25, stale-after > 0, and max-children between 1 and 1000")
    for root_id in args.codex_root:
        try:
            uuid.UUID(root_id)
        except ValueError:
            parser.error("Each --codex-root must be an explicit chat UUID")
    if args.output is not None and args.output.parent.resolve() == args.claude_dir.resolve():
        parser.error("Write the combined output outside the Claude Code observation directory")
    args.claude_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    directory = args.claude_dir.stat()
    if directory.st_uid != os.getuid() or directory.st_mode & 0o077:
        parser.error("Use a private observation directory owned by the current user (permissions 700)")
    last_codex = []
    while True:
        now_ms = int(time.time() * 1000)
        claude, errors = claude_observations(args.claude_dir, now_ms, args.stale_after * 1000)
        reader = None
        if args.codex_root:
            try:
                reader = CodexReader(args.codex_socket)
                last_codex = codex_observations(reader, list(dict.fromkeys(args.codex_root)), args.max_children)
            except (OSError, ValueError, RuntimeError, KeyError) as error:
                errors.append({"source": "shared_codex_server", "error": str(error)})
                for session in last_codex:
                    session["isStale"] = True
                    for agent in session["agents"]:
                        agent["observedStatus"] = "unknown"
            finally:
                if reader is not None:
                    reader.close()
        result = {
            "schemaVersion": 1, "observedAtMs": now_ms,
            "sessions": [*claude, *last_codex], "errors": errors,
        }
        value = json.dumps(result, ensure_ascii=False)
        if args.output is None:
            print(value, flush=True)
        else:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            with tempfile.NamedTemporaryFile(
                mode="w", encoding="utf-8", dir=args.output.parent,
                prefix=args.output.name + ".", delete=False,
            ) as stream:
                temporary = Path(stream.name)
                stream.write(value + "\n")
            try:
                temporary.replace(args.output)
            finally:
                temporary.unlink(missing_ok=True)
        if args.once:
            return 1 if errors else 0
        time.sleep(args.interval)


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        pass
