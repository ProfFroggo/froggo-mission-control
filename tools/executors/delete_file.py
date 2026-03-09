#!/usr/bin/env python3
# Purpose: Safely delete a file. Requires explicit confirm=true in payload.
# Refuses paths containing ".." or resolving outside the user's home directory.

import json
import os
import sys


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"ok": False, "error": "No JSON argument provided"}))
        sys.exit(1)

    try:
        payload = json.loads(sys.argv[1])
    except json.JSONDecodeError as e:
        print(json.dumps({"ok": False, "error": f"Invalid JSON: {e}"}))
        sys.exit(1)

    path = payload.get("path")
    confirm = payload.get("confirm")

    if not path:
        print(json.dumps({"ok": False, "error": "Missing required field: path"}))
        sys.exit(1)

    if confirm is not True:
        print(json.dumps({"ok": False, "error": "Safety check failed: confirm must be true to delete a file"}))
        sys.exit(1)

    if ".." in path:
        print(json.dumps({"ok": False, "error": "Safety check failed: path must not contain '..'"}))
        sys.exit(1)

    home_dir = os.path.realpath(os.path.expanduser("~"))
    resolved_path = os.path.realpath(os.path.expanduser(path))

    if not resolved_path.startswith(home_dir + os.sep) and resolved_path != home_dir:
        print(json.dumps({
            "ok": False,
            "error": f"Safety check failed: path resolves outside home directory ({home_dir})"
        }))
        sys.exit(1)

    if not os.path.exists(resolved_path):
        print(json.dumps({"ok": False, "error": f"File not found: {resolved_path}"}))
        sys.exit(1)

    if not os.path.isfile(resolved_path):
        print(json.dumps({"ok": False, "error": f"Path is not a file: {resolved_path}"}))
        sys.exit(1)

    try:
        os.remove(resolved_path)
        print(json.dumps({"ok": True, "result": f"Deleted: {resolved_path}"}))
        sys.exit(0)
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
