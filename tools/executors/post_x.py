#!/usr/bin/env python3
# Purpose: Post a tweet to X/Twitter using tweepy v2 API (tweepy.Client).
# Requires TWITTER_BEARER_TOKEN, TWITTER_API_KEY, TWITTER_API_SECRET,
# TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET env vars.

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

    text = payload.get("text")
    if not text:
        print(json.dumps({"ok": False, "error": "Missing required field: text"}))
        sys.exit(1)

    reply_to = payload.get("reply_to")

    bearer_token = os.environ.get("TWITTER_BEARER_TOKEN")
    api_key = os.environ.get("TWITTER_API_KEY")
    api_secret = os.environ.get("TWITTER_API_SECRET")
    access_token = os.environ.get("TWITTER_ACCESS_TOKEN")
    access_secret = os.environ.get("TWITTER_ACCESS_SECRET")

    if not all([bearer_token, api_key, api_secret, access_token, access_secret]):
        print(json.dumps({
            "ok": False,
            "error": (
                "Twitter credentials not configured. Set TWITTER_BEARER_TOKEN, "
                "TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, "
                "TWITTER_ACCESS_SECRET env vars."
            )
        }))
        sys.exit(1)

    try:
        import tweepy
    except ImportError:
        print(json.dumps({"ok": False, "error": "tweepy is not installed. Run: pip install tweepy"}))
        sys.exit(1)

    try:
        client = tweepy.Client(
            bearer_token=bearer_token,
            consumer_key=api_key,
            consumer_secret=api_secret,
            access_token=access_token,
            access_token_secret=access_secret,
        )

        kwargs = {"text": text}
        if reply_to:
            kwargs["in_reply_to_tweet_id"] = reply_to

        response = client.create_tweet(**kwargs)
        tweet_id = response.data["id"]
        print(json.dumps({"ok": True, "result": f"Tweet posted successfully. ID: {tweet_id}"}))
        sys.exit(0)
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
