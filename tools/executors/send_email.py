#!/usr/bin/env python3
# Purpose: Send an email via SMTP using stdlib only (smtplib + email.mime).
# Reads credentials from SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASSWORD env vars,
# or falls back to GMAIL_USER/GMAIL_APP_PASSWORD for Gmail.

import json
import os
import smtplib
import sys
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"ok": False, "error": "No JSON argument provided"}))
        sys.exit(1)

    try:
        payload = json.loads(sys.argv[1])
    except json.JSONDecodeError as e:
        print(json.dumps({"ok": False, "error": f"Invalid JSON: {e}"}))
        sys.exit(1)

    to = payload.get("to")
    subject = payload.get("subject")
    body = payload.get("body")

    if not to:
        print(json.dumps({"ok": False, "error": "Missing required field: to"}))
        sys.exit(1)
    if not subject:
        print(json.dumps({"ok": False, "error": "Missing required field: subject"}))
        sys.exit(1)
    if body is None:
        print(json.dumps({"ok": False, "error": "Missing required field: body"}))
        sys.exit(1)

    smtp_host = os.environ.get("SMTP_HOST")
    smtp_port = os.environ.get("SMTP_PORT")
    smtp_user = os.environ.get("SMTP_USER")
    smtp_password = os.environ.get("SMTP_PASSWORD")

    gmail_user = os.environ.get("GMAIL_USER")
    gmail_password = os.environ.get("GMAIL_APP_PASSWORD")

    if smtp_host and smtp_user and smtp_password:
        host = smtp_host
        port = int(smtp_port) if smtp_port else 587
        user = smtp_user
        password = smtp_password
        from_addr = payload.get("from") or smtp_user
    elif gmail_user and gmail_password:
        host = "smtp.gmail.com"
        port = 587
        user = gmail_user
        password = gmail_password
        from_addr = payload.get("from") or gmail_user
    else:
        print(json.dumps({
            "ok": False,
            "error": (
                "Email credentials not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, "
                "SMTP_PASSWORD env vars, or GMAIL_USER + GMAIL_APP_PASSWORD for Gmail."
            )
        }))
        sys.exit(1)

    reply_to = payload.get("reply_to")

    try:
        msg = MIMEMultipart()
        msg["From"] = from_addr
        msg["To"] = to
        msg["Subject"] = subject
        if reply_to:
            msg["Reply-To"] = reply_to
        msg.attach(MIMEText(body, "plain"))

        with smtplib.SMTP(host, port) as server:
            server.ehlo()
            server.starttls()
            server.login(user, password)
            server.sendmail(from_addr, [to], msg.as_string())

        print(json.dumps({"ok": True, "result": f"Email sent successfully to {to}"}))
        sys.exit(0)
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
