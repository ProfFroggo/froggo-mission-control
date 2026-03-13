#!/usr/bin/env python3
"""Complete reply-guy onboarding v2 DB update via Python sqlite3 (no node required)."""

import sqlite3
import os
import time
import random
import string
import json
from datetime import datetime, timezone

DB_PATH = os.path.expanduser('~/mission-control/data/mission-control.db')
MEMORY_PATH = os.path.expanduser('~/mission-control/memory')

TASK_ID = 'task-1773272241081-xfzyk5'
AGENT_ID = 'reply-guy'

def uid(prefix):
    ts = int(time.time() * 1000)
    rand = ''.join(random.choices(string.ascii_lowercase + string.digits, k=5))
    return f"{prefix}-{ts}-{rand}"

def now():
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')

conn = sqlite3.connect(DB_PATH)
conn.execute("PRAGMA journal_mode=WAL")
conn.execute("PRAGMA foreign_keys=ON")
cur = conn.cursor()

# -- Check current task state
cur.execute("SELECT id, title, status, progress FROM tasks WHERE id=?", (TASK_ID,))
task = cur.fetchone()
print(f"Current task: {task}")

# -- Check existing subtasks
cur.execute("SELECT COUNT(*) FROM subtasks WHERE task_id=?", (TASK_ID,))
existing_count = cur.fetchone()[0]
print(f"Existing subtasks: {existing_count}")

# STEP 2: Update task to in-progress at 5%
ts = now()
conn.execute("UPDATE tasks SET status=?, progress=?, updated_at=? WHERE id=?",
             ('in-progress', 5, ts, TASK_ID))
conn.execute("INSERT INTO task_activities (id, task_id, agent_id, action, message, created_at) VALUES (?,?,?,?,?,?)",
             (uid('act'), TASK_ID, AGENT_ID, 'started',
              'Started: Reading onboarding docs, X strategy skill, and producing sample replies to complete first-day orientation', ts))
print("Step 2: Task set to in-progress (5%)")

# STEP 3: Write planning notes
planning = """First Day Onboarding Plan:
1. Search memory for any existing context
2. Read the X/Twitter strategy skill
3. Read existing onboarding doc / sample replies
4. Produce 10 high-quality sample reply examples covering key scenarios
5. Save sample replies to ~/mission-control/library/docs/research/2026-03-12_reply-guy-sample-replies-v2.md
6. Write memory note summarizing key patterns
7. Mark all subtasks complete and hand off to Clara"""

conn.execute("UPDATE tasks SET planning_notes=?, updated_at=? WHERE id=?",
             (planning, now(), TASK_ID))
print("Step 3: Planning notes written")

# STEP 4: Create subtasks (skip if already exist)
subtask_ids = []
if existing_count == 0:
    subtasks = [
        'Read X/Twitter strategy skill and onboarding docs',
        'Review existing sample replies',
        'Produce 10 sample reply examples across key scenarios',
        'Save sample replies file and write memory note',
    ]
    for title in subtasks:
        sid = uid('sub')
        subtask_ids.append(sid)
        ts = now()
        conn.execute("INSERT INTO subtasks (id, task_id, title, completed, assigned_to, created_at, updated_at) VALUES (?,?,?,?,?,?,?)",
                     (sid, TASK_ID, title, 0, AGENT_ID, ts, ts))
    print(f"Step 4: Created {len(subtask_ids)} subtasks: {subtask_ids}")
else:
    cur.execute("SELECT id FROM subtasks WHERE task_id=? ORDER BY created_at", (TASK_ID,))
    rows = cur.fetchall()
    subtask_ids = [r[0] for r in rows]
    print(f"Step 4: Using existing subtasks: {subtask_ids}")

def complete_subtask(idx, progress, message):
    ts = now()
    conn.execute("UPDATE tasks SET progress=?, updated_at=? WHERE id=?", (progress, ts, TASK_ID))
    if idx < len(subtask_ids):
        conn.execute("UPDATE subtasks SET completed=1, updated_at=? WHERE id=?", (ts, subtask_ids[idx]))
    conn.execute("INSERT INTO task_activities (id, task_id, agent_id, action, message, created_at) VALUES (?,?,?,?,?,?)",
                 (uid('act'), TASK_ID, AGENT_ID, 'updated', message, ts))
    print(f"  Subtask {idx+1} complete ({progress}%)")

# STEP 5a: Subtask 1
complete_subtask(0, 25,
    'Completed: Read X/Twitter strategy skill and onboarding docs — voice patterns understood: <200 chars, empathy for newcomers, peer-level for crypto natives, calm + factual for FUD, never fight back')

# STEP 5b: Subtask 2
complete_subtask(1, 50,
    'Completed: Reviewed existing sample replies v1 (10 scenarios: newcomer/degen/FUD/first-tx/fees/DeFi-yield/chain-skeptic/power-user/confused-user/feature-request)')

# STEP 5c: Subtask 3
complete_subtask(2, 75,
    'Completed: Produced 10 sample reply examples v2 — newcomer, crypto-native agent coordination, FUD/dev-replacement, frustrated user, excited first team, skeptic, builder use cases, pricing, competitor comparison, general hype')

# STEP 5d: Subtask 4 — write memory note
memory_dir = os.path.join(MEMORY_PATH, 'agents', 'reply-guy')
os.makedirs(memory_dir, exist_ok=True)
memory_note = """---
category: task
title: 2026-03-12-reply-guy-onboarding-v2
date: 2026-03-12
tags: reply-guy, onboarding, sample-replies, froggo, x-twitter
---

# reply-guy onboarding v2

Completed second pass of first-day onboarding. Produced 10 sample reply examples v2 covering: newcomer, crypto-native, FUD, frustrated user, excited user, skeptic, builder, pricing, competitor comparison, general hype.

Key voice patterns: <200 chars, empathy for newcomers, peer-level for crypto natives, calm + factual for FUD, never fight back.

File saved to library/docs/research/2026-03-12_reply-guy-sample-replies-v2.md.

Voice summary:
- Newcomer: warm, simple, plain language
- Crypto-native: peer-level, use their vocab
- FUD: calm, reframe, never combative
- Frustrated: own it fast, DM help, signal fix
- Skeptic: invite experimentation, skip the pitch
- Builder: concrete examples, open dialogue
- Pricing: direct, highlight free tier
- Competitor: complementary framing, no bashing
"""
mem_file = os.path.join(memory_dir, '2026-03-12-reply-guy-onboarding-v2.md')
with open(mem_file, 'w') as f:
    f.write(memory_note)
print(f"Memory note written to: {mem_file}")

complete_subtask(3, 90,
    'Completed: Saved sample replies v2 to library/docs/research/2026-03-12_reply-guy-sample-replies-v2.md and wrote memory note to agents/reply-guy/')

# STEP 5e: Attach the file
att_id = uid('att')
conn.execute("INSERT INTO task_attachments (id, task_id, file_path, file_name, category, uploaded_by, created_at) VALUES (?,?,?,?,?,?,?)",
             (att_id, TASK_ID,
              '/Users/kevin.macarthur/mission-control/library/docs/research/2026-03-12_reply-guy-sample-replies-v2.md',
              '2026-03-12_reply-guy-sample-replies-v2.md',
              'output', AGENT_ID, now()))
print(f"Step 5e: Attachment added: {att_id}")

# STEP 6: Verify
cur.execute("SELECT COUNT(*) FROM subtasks WHERE task_id=? AND completed=1", (TASK_ID,))
done = cur.fetchone()[0]
cur.execute("SELECT COUNT(*) FROM subtasks WHERE task_id=?", (TASK_ID,))
total = cur.fetchone()[0]
print(f"Step 6: Subtasks complete: {done}/{total}")

# STEP 7: Internal review
ts = now()
conn.execute("UPDATE tasks SET status=?, progress=?, updated_at=? WHERE id=?",
             ('internal-review', 95, ts, TASK_ID))
conn.execute("INSERT INTO task_activities (id, task_id, agent_id, action, message, created_at) VALUES (?,?,?,?,?,?)",
             (uid('act'), TASK_ID, AGENT_ID, 'updated',
              'Internal review: plan verified, all 4 subtasks complete — read X strategy skill, reviewed existing samples, produced 10 new sample replies v2, saved file and wrote memory note', ts))
print("Step 7: Task moved to internal-review (95%)")

# STEP 8: Hand off to Clara
ts = now()
conn.execute("INSERT INTO task_activities (id, task_id, agent_id, action, message, created_at) VALUES (?,?,?,?,?,?)",
             (uid('act'), TASK_ID, AGENT_ID, 'completed',
              'Done: Completed first-day onboarding — read X strategy skill and brand guidelines, produced 10 sample replies across all key scenarios (newcomer, crypto-native, FUD, frustrated user, builder, skeptic), saved to library and wrote memory note', ts))
conn.execute("UPDATE tasks SET status=?, progress=?, last_agent_update=?, updated_at=? WHERE id=?",
             ('agent-review', 100,
              'Done: First day onboarding complete — 10 sample replies v2 produced and saved', ts, TASK_ID))
print("Step 8: Task moved to agent-review (100%) — handed off to Clara")

conn.commit()
conn.close()
print(f"\nAll done! Task {TASK_ID} is now in agent-review.")
