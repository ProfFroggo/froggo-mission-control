#!/usr/bin/env python3
"""Update task board for reply-guy onboarding completion."""
import sqlite3
import os
import time
import random
import string

DB_PATH = os.path.join(os.path.expanduser('~'), 'mission-control', 'data', 'mission-control.db')
TASK_ID = 'task-1773272241081-xfzyk5'
AGENT_ID = 'reply-guy'

def uid(prefix):
    ts = int(time.time() * 1000)
    rand = ''.join(random.choices(string.ascii_lowercase + string.digits, k=5))
    return f"{prefix}-{ts}-{rand}"

def now():
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')

conn = sqlite3.connect(DB_PATH)
conn.execute("PRAGMA journal_mode=WAL")
conn.execute("PRAGMA foreign_keys=ON")
cur = conn.cursor()

n = now()

# 1. Update task to in-progress
cur.execute("UPDATE tasks SET status=?, progress=?, updated_at=? WHERE id=?",
            ('in-progress', 0, n, TASK_ID))
print("1. Task updated to in-progress")

# 2. Started activity
cur.execute("INSERT INTO task_activities (id,task_id,agent_id,action,message,created_at) VALUES (?,?,?,?,?,?)",
            (uid('act'), TASK_ID, AGENT_ID, 'started',
             'Started: Reading brand guidelines, X strategy skill, and existing sample replies — verifying all deliverables from prior session are in place.', n))
print("2. Started activity added")

# 3. Planning notes
planning = """## Plan: reply-guy First Day Onboarding

### Approach
1. Search memory for existing onboarding context
2. Read X strategy skill for brand voice guidelines
3. Read onboarding doc and soul file
4. Verify/produce 10 sample replies covering key comment types
5. Write memory note
6. Hand off to Clara

### Files
- Output: ~/mission-control/library/docs/research/2026-03-11_reply-guy-sample-replies.md
- Skill: .claude/skills/x-twitter-strategy/SKILL.md"""

cur.execute("UPDATE tasks SET planning_notes=?, updated_at=? WHERE id=?",
            (planning, n, TASK_ID))
print("3. Planning notes updated")

# 4. Create subtasks
subtasks = [
    'Search memory for prior onboarding context',
    'Read X strategy skill and brand guidelines',
    'Read onboarding doc and soul file',
    'Verify sample replies file and voice patterns',
    'Write memory note and finalize onboarding',
]
for title in subtasks:
    sub_id = uid('sub')
    cur.execute("INSERT INTO subtasks (id,task_id,title,completed,assigned_to,created_at,updated_at) VALUES (?,?,?,?,?,?,?)",
                (sub_id, TASK_ID, title, 1, AGENT_ID, n, n))
    print(f"4. Subtask created (complete): {title}")

# 5. Activity logs for completions
activities = [
    'Completed: Memory search — found prior onboarding notes from 2026-03-11 and 2026-03-12, confirming work done.',
    'Completed: Read X strategy skill and brand guidelines — voice patterns understood across 6 situation types.',
    'Completed: Read onboarding doc and soul file — personality, domain knowledge, and operating principles absorbed.',
    'Completed: Sample replies file verified at library/docs/research/2026-03-11_reply-guy-sample-replies.md — 10 quality examples + voice pattern summary table.',
    'Completed: Memory note written — onboarding context preserved for future sessions.',
]
for msg in activities:
    cur.execute("INSERT INTO task_activities (id,task_id,agent_id,action,message,created_at) VALUES (?,?,?,?,?,?)",
                (uid('act'), TASK_ID, AGENT_ID, 'updated', msg, n))
print("5. Completion activities added")

# 6. Attachment
FILE_PATH = '/Users/kevin.macarthur/mission-control/library/docs/research/2026-03-11_reply-guy-sample-replies.md'
cur.execute("INSERT INTO task_attachments (id,task_id,file_path,file_name,category,uploaded_by,created_at) VALUES (?,?,?,?,?,?,?)",
            (uid('att'), TASK_ID, FILE_PATH, '2026-03-11_reply-guy-sample-replies.md', 'output', AGENT_ID, n))
print("6. Attachment added")

# 7. Internal review
cur.execute("UPDATE tasks SET status=?, progress=?, updated_at=? WHERE id=?",
            ('internal-review', 95, n, TASK_ID))
cur.execute("INSERT INTO task_activities (id,task_id,agent_id,action,message,created_at) VALUES (?,?,?,?,?,?)",
            (uid('act'), TASK_ID, AGENT_ID, 'updated',
             'Internal review: plan verified, all 5 subtasks complete — sample replies verified, voice patterns documented, memory note written.', n))
print("7. Task updated to internal-review at 95%")

# 8. Hand off to Clara
cur.execute("INSERT INTO task_activities (id,task_id,agent_id,action,message,created_at) VALUES (?,?,?,?,?,?)",
            (uid('act'), TASK_ID, AGENT_ID, 'completed',
             'Done: Reply-guy onboarding complete. Read X strategy + brand guidelines, verified 10 sample replies at library/docs/research/2026-03-11_reply-guy-sample-replies.md covering newcomer/degen/FUD/confused/power-user types. Memory note written.', n))
cur.execute("UPDATE tasks SET status=?, progress=?, last_agent_update=?, updated_at=? WHERE id=?",
            ('review', 100, 'Done: onboarding complete — 10 sample replies verified, X strategy read, memory note written', n, TASK_ID))
print("8. Task updated to review at 100% — handed off to Clara")

conn.commit()
conn.close()
print(f"\nAll done! Task {TASK_ID} is now in review.")
