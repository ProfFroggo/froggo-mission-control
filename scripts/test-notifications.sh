#!/bin/bash
# Test notification system by simulating events

echo "🔔 Testing Notification System"
echo "================================"

DB_PATH="$HOME/clawd/data/froggo.db"

# Test 1: Trigger a task completion
echo "1. Creating test task..."
TASK_ID="test-notify-$(date +%s)"
sqlite3 "$DB_PATH" "INSERT INTO tasks (id, title, status, created_at, updated_at) VALUES ('$TASK_ID', 'Test Notification Task', 'in-progress', $(date +%s)000, $(date +%s)000)"

sleep 2

echo "2. Marking task as completed..."
NOW=$(date +%s)000
sqlite3 "$DB_PATH" "INSERT INTO task_activity (task_id, action, message, agent_id, timestamp) VALUES ('$TASK_ID', 'completed', 'Test completion', 'coder', $NOW)"

echo "✅ Task completion event triggered"
echo "   → You should see a notification: '✅ Task Completed: Test Notification Task'"

sleep 3

# Test 2: Trigger an agent failure
echo ""
echo "3. Simulating agent failure..."
FAIL_TASK_ID="test-fail-$(date +%s)"
sqlite3 "$DB_PATH" "INSERT INTO tasks (id, title, status, created_at, updated_at) VALUES ('$FAIL_TASK_ID', 'Failed Task Test', 'in-progress', $(date +%s)000, $(date +%s)000)"

sleep 1

NOW=$(date +%s)000
sqlite3 "$DB_PATH" "INSERT INTO task_activity (task_id, action, message, agent_id, timestamp) VALUES ('$FAIL_TASK_ID', 'blocked', 'API credentials missing', 'coder', $NOW)"

echo "⚠️  Agent failure event triggered"
echo "   → You should see a notification: '⚠️ coder Blocked: Failed Task Test'"

sleep 3

# Test 3: Add an approval request
echo ""
echo "4. Adding approval request..."
APPROVAL_PATH="$HOME/clawd/approvals/queue.json"
mkdir -p "$(dirname "$APPROVAL_PATH")"

APPROVAL_ID="test-approval-$(date +%s)"
cat > "$APPROVAL_PATH" << EOF
{
  "description": "Approval queue - Froggo adds items here, dashboard picks them up",
  "items": [
    {
      "id": "$APPROVAL_ID",
      "type": "tweet",
      "title": "Test Tweet: Hello from notifications!",
      "content": "Testing the notification system 🎉",
      "status": "pending",
      "createdAt": $(date +%s)000
    }
  ]
}
EOF

echo "🔔 Approval request added"
echo "   → You should see a notification: '🔔 Approval Needed: Test Tweet...'"

echo ""
echo "================================"
echo "✅ Test complete!"
echo ""
echo "Expected notifications:"
echo "1. Task completed notification"
echo "2. Agent failure notification"
echo "3. Approval needed notification"
echo ""
echo "Check your system notifications (top-right corner on macOS)"
echo "Also check the Dashboard → Notifications panel for in-app notifications"
echo ""
echo "Cleanup: Test tasks and approvals remain in database for verification"
