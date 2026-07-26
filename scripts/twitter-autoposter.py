#!/usr/bin/env python3
"""Post current Qazaq Lens explainers to X without a stale hard-coded article list.

Setup:
  pip install tweepy schedule
  export TWITTER_API_KEY=...
  export TWITTER_API_SECRET=...
  export TWITTER_ACCESS_TOKEN=...
  export TWITTER_ACCESS_SECRET=...

Run once:
  python scripts/twitter-autoposter.py --once

Run every three days:
  python scripts/twitter-autoposter.py

The script reads public/data/claims.json, so new explainers are included after
the normal build. It keeps credentials in environment variables and never
stores them in the repository.
"""

import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path

import tweepy
import schedule


ROOT = Path(__file__).resolve().parents[1]
DATA_FILE = ROOT / "public" / "data" / "claims.json"
STATE_FILE = Path(__file__).with_name(".twitter_state.json")
MAX_POST_LENGTH = 280


def load_claims():
    data = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    claims = data.get("claims", [])
    if not claims:
        raise RuntimeError(f"No claims found in {DATA_FILE}")
    return claims


def load_state():
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    return {"index": 0, "posted": []}


def save_state(state):
    STATE_FILE.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")


def get_client():
    return tweepy.Client(
        consumer_key=os.environ["TWITTER_API_KEY"],
        consumer_secret=os.environ["TWITTER_API_SECRET"],
        access_token=os.environ["TWITTER_ACCESS_TOKEN"],
        access_token_secret=os.environ["TWITTER_ACCESS_SECRET"],
    )


def make_post(claim):
    verdict = str(claim.get("verdict", "")).upper()
    title = claim.get("claim", "")
    summary = claim.get("summary", "")
    url = claim.get("article_url", "")
    topics = claim.get("topics", [])
    tags = " ".join(f"#{topic.replace(' ', '')}" for topic in topics[:2])
    prefix = f"🇰🇿 {verdict}: {title}\n\n"
    suffix = f"\n\n{url}"
    available = MAX_POST_LENGTH - len(prefix) - len(suffix) - (len(tags) + 2 if tags else 0)
    excerpt = summary.strip()
    if len(excerpt) > available:
        excerpt = excerpt[: max(0, available - 1)].rsplit(" ", 1)[0] + "…"
    return f"{prefix}{excerpt}{suffix}{f'\n\n{tags}' if tags else ''}"


def post_next():
    claims = load_claims()
    state = load_state()
    index = state.get("index", 0) % len(claims)
    claim = claims[index]
    response = get_client().create_tweet(text=make_post(claim))
    timestamp = datetime.now().isoformat(timespec="seconds")
    print(f"[{timestamp}] Posted {index + 1}/{len(claims)}: {claim['slug']} ({response.data['id']})")
    state["index"] = index + 1
    state.setdefault("posted", []).append({"slug": claim["slug"], "id": response.data["id"], "ts": timestamp})
    save_state(state)


if __name__ == "__main__":
    if "--once" in sys.argv:
        post_next()
    else:
        print("Scheduler started. Current claims are read every three days at 10:00.")
        schedule.every(3).days.at("10:00").do(post_next)
        while True:
            schedule.run_pending()
            time.sleep(60)
