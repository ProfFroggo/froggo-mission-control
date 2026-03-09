#!/usr/bin/env python3
# post_x.py — Post a tweet via the local Mission Control X API route.
# Delegates to /api/x/tweet which uses TWITTER_API_KEY / TWITTER_ACCESS_TOKEN_SECRET.
# Payload: {"text": str, "reply_to": str (optional)}

import sys
import json
import urllib.request
import urllib.error
import os


def main():
    try:
        payload = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}
    except (IndexError, json.JSONDecodeError) as e:
        print(json.dumps({"ok": False, "error": f"Invalid payload: {e}"}))
        sys.exit(1)

    text = payload.get("text", "").strip()
    if not text:
        print(json.dumps({"ok": False, "error": "text is required"}))
        sys.exit(1)

    port = os.environ.get("PORT", "3000")
    url = f"http://localhost:{port}/api/x/tweet"

    body = {"text": text}
    if payload.get("reply_to"):
        body["reply_to"] = payload["reply_to"]

    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            print(json.dumps({"ok": True, "result": f"Posted tweet id={data.get('id')}", "data": data}))
    except urllib.error.HTTPError as e:
        body_text = e.read().decode("utf-8", errors="replace")
        try:
            err = json.loads(body_text).get("error", body_text)
        except Exception:
            err = body_text
        print(json.dumps({"ok": False, "error": f"HTTP {e.code}: {err}"}))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
