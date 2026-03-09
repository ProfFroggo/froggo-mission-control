#!/usr/bin/env python3
# send_email.py — Send email via the local Mission Control Gmail route.
# Delegates to /api/gmail/messages/send which uses Google OAuth (MCP-connected account).
# No SMTP credentials needed — uses the Google account already connected in the platform.
# Payload: {"to": str, "subject": str, "body": str, "html": str (optional), "inReplyTo": str (optional)}

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

    to = payload.get("to", "").strip()
    subject = payload.get("subject", "").strip()
    body = payload.get("body", "").strip()
    html = payload.get("html")
    in_reply_to = payload.get("inReplyTo") or payload.get("in_reply_to")

    if not to:
        print(json.dumps({"ok": False, "error": "to is required"}))
        sys.exit(1)
    if not subject:
        print(json.dumps({"ok": False, "error": "subject is required"}))
        sys.exit(1)
    if not body and not html:
        print(json.dumps({"ok": False, "error": "body or html is required"}))
        sys.exit(1)

    port = os.environ.get("PORT", "3000")
    url = f"http://localhost:{port}/api/gmail/messages/send"

    request_body = {"to": to, "subject": subject}
    if html:
        request_body["html"] = html
    else:
        request_body["body"] = body
    if in_reply_to:
        request_body["inReplyTo"] = in_reply_to

    req = urllib.request.Request(
        url,
        data=json.dumps(request_body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            print(json.dumps({"ok": True, "result": f"Email sent to {to}", "data": data}))
    except urllib.error.HTTPError as e:
        body_text = e.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(body_text)
            err = parsed.get("error", body_text)
            if parsed.get("needsAuth"):
                err = "Google account not connected. Authenticate via Mission Control Settings → Integrations."
        except Exception:
            err = body_text
        print(json.dumps({"ok": False, "error": f"HTTP {e.code}: {err}"}))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
