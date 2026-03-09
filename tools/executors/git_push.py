#!/usr/bin/env python3
# Purpose: Run git push for a given repo path and branch.
# Refuses force-push to main/master unless force=true is explicitly set in payload.

import json
import os
import subprocess
import sys


PROTECTED_BRANCHES = {"main", "master"}


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"ok": False, "error": "No JSON argument provided"}))
        sys.exit(1)

    try:
        payload = json.loads(sys.argv[1])
    except json.JSONDecodeError as e:
        print(json.dumps({"ok": False, "error": f"Invalid JSON: {e}"}))
        sys.exit(1)

    repo_path = payload.get("repo_path")
    if not repo_path:
        print(json.dumps({"ok": False, "error": "Missing required field: repo_path"}))
        sys.exit(1)

    branch = payload.get("branch", "main")
    remote = payload.get("remote", "origin")
    force = payload.get("force", False)

    resolved_path = os.path.realpath(os.path.expanduser(repo_path))
    if not os.path.isdir(resolved_path):
        print(json.dumps({"ok": False, "error": f"repo_path is not a directory: {resolved_path}"}))
        sys.exit(1)

    if force and branch.lower() in PROTECTED_BRANCHES:
        print(json.dumps({
            "ok": False,
            "error": (
                f"Safety check failed: force push to '{branch}' is not allowed. "
                "Use a feature branch or explicitly acknowledge the risk."
            )
        }))
        sys.exit(1)

    cmd = ["git", "push", remote, branch]
    if force:
        cmd.append("--force")

    try:
        result = subprocess.run(
            cmd,
            cwd=resolved_path,
            capture_output=True,
            text=True,
        )

        output_parts = []
        if result.stdout.strip():
            output_parts.append(result.stdout.strip())
        if result.stderr.strip():
            output_parts.append(result.stderr.strip())
        combined = "\n".join(output_parts) if output_parts else "(no output)"

        if result.returncode == 0:
            print(json.dumps({"ok": True, "result": combined}))
            sys.exit(0)
        else:
            print(json.dumps({"ok": False, "error": combined}))
            sys.exit(1)
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
