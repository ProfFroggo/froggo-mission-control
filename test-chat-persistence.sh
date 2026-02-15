#!/bin/bash
# Test script to verify chat message persistence in the dashboard

echo "=== Chat Persistence Test ==="
echo ""

# 1. Check if messages table exists
echo "1. Checking if messages table exists..."
TABLE_CHECK=$(sqlite3 ~/froggo/data/froggo.db "SELECT name FROM sqlite_master WHERE type='table' AND name='messages';" 2>&1)
if [ -z "$TABLE_CHECK" ]; then
  echo "   ❌ FAIL: messages table does not exist"
  exit 1
else
  echo "   ✅ PASS: messages table exists"
fi

# 2. Count messages in database
echo ""
echo "2. Counting messages in database..."
MSG_COUNT=$(sqlite3 ~/froggo/data/froggo.db "SELECT COUNT(*) FROM messages WHERE session_key='dashboard' AND channel='dashboard';" 2>&1)
echo "   Found: $MSG_COUNT messages"

# 3. Show recent messages
echo ""
echo "3. Recent messages (last 5):"
sqlite3 ~/froggo/data/froggo.db "SELECT 
  id, 
  role, 
  substr(content, 1, 60) as preview,
  datetime(timestamp) as time
FROM messages 
WHERE session_key='dashboard' AND channel='dashboard' 
ORDER BY timestamp DESC 
LIMIT 5;" -box

# 4. Test IPC handler simulation (save a test message)
echo ""
echo "4. Testing message save (simulate user message)..."
TEST_CONTENT="Test message from persistence verification script"
TEST_TS=$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")
sqlite3 ~/froggo/data/froggo.db "INSERT INTO messages (timestamp, session_key, channel, role, content) VALUES ('$TEST_TS', 'dashboard', 'dashboard', 'user', '$TEST_CONTENT');"

if [ $? -eq 0 ]; then
  echo "   ✅ PASS: Test message saved successfully"
else
  echo "   ❌ FAIL: Could not save test message"
  exit 1
fi

# 5. Verify test message was saved
echo ""
echo "5. Verifying test message..."
VERIFY=$(sqlite3 ~/froggo/data/froggo.db "SELECT content FROM messages WHERE content='$TEST_CONTENT';" 2>&1)
if [ "$VERIFY" == "$TEST_CONTENT" ]; then
  echo "   ✅ PASS: Test message retrieved successfully"
else
  echo "   ❌ FAIL: Could not retrieve test message"
  exit 1
fi

# 6. Clean up test message
echo ""
echo "6. Cleaning up test message..."
sqlite3 ~/froggo/data/froggo.db "DELETE FROM messages WHERE content='$TEST_CONTENT';"
echo "   ✅ Test message cleaned up"

echo ""
echo "=== All Tests Passed ✅ ==="
echo ""
echo "Summary:"
echo "- Messages table exists and is accessible"
echo "- Database has $MSG_COUNT persisted messages"
echo "- Save/retrieve operations working correctly"
echo ""
echo "Next steps:"
echo "1. Open the dashboard: open -a /Applications/Froggo.app"
echo "2. Navigate to Chat panel"
echo "3. Verify chat history loads automatically"
echo "4. Send a message and close the dashboard"
echo "5. Reopen dashboard and verify message persists"
