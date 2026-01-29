# Froggo Dashboard - Troubleshooting Guide

**Comprehensive solutions for common issues**

---

## Table of Contents

1. [Quick Diagnostics](#quick-diagnostics)
2. [Installation & Launch Issues](#installation--launch-issues)
3. [Task & Agent Problems](#task--agent-problems)
4. [Voice Assistant Issues](#voice-assistant-issues)
5. [Calendar & Integration Issues](#calendar--integration-issues)
6. [Performance Problems](#performance-problems)
7. [Data & Sync Issues](#data--sync-issues)
8. [UI & Display Issues](#ui--display-issues)
9. [Error Messages Decoded](#error-messages-decoded)
10. [Advanced Troubleshooting](#advanced-troubleshooting)

---

## Quick Diagnostics

### Health Check

**Run System Diagnostic:**

```bash
# Open Terminal and run:
~/clawd/scripts/diagnostic.sh

# Shows:
✓ Database connectivity
✓ Agent service status
✓ API credentials
✓ Disk space
✓ Memory usage
✓ Vosk model integrity
```

**In-App Health Check:**

```
Settings > System > Run Diagnostic

Checks:
✓ All connected accounts
✓ Sync status
✓ Active sessions
✓ Error logs
✓ Performance metrics
```

---

### Common Quick Fixes

**80% of issues solved by:**

1. **Restart Froggo** (`⌘Q` then relaunch)
2. **Refresh Panel** (`⌘R` in any panel)
3. **Clear Cache** (Settings > Advanced > Clear Cache)
4. **Update App** (Settings > About > Check for Updates)
5. **Check Internet** (Many features require connection)

---

## Installation & Launch Issues

### App Won't Launch

**Problem:** Double-clicking Froggo.app does nothing

**Solutions:**

**1. Check Security Settings**
```
macOS blocks unidentified apps by default:

System Preferences > Security & Privacy > General
Look for: "Froggo.app was blocked"
Click: "Open Anyway"
```

**2. Check Application Integrity**
```bash
# Verify app isn't corrupted
cd /Applications
ls -l Froggo.app

# Should show proper directory structure
# If missing or incomplete, reinstall
```

**3. Check Logs**
```bash
# View crash logs
Console.app > Crash Reports
Look for: Froggo crashes

# Or terminal:
~/Library/Logs/Froggo/
cat latest.log
```

**4. Permissions Issues**
```bash
# Fix permissions
chmod -R 755 /Applications/Froggo.app

# Clear quarantine attribute
xattr -cr /Applications/Froggo.app
```

---

### Stuck on Splash Screen

**Problem:** App loads but stuck at loading screen

**Solutions:**

**1. Wait Longer**
```
First launch: Can take 60-90 seconds
Reason: Model downloads, database init

Watch for progress:
"Downloading Vosk model... (45 MB)"
"Initializing database..."
"Connecting to services..."
```

**2. Check Database**
```bash
# Verify database exists and isn't locked
cd ~/clawd/data
ls -lh froggo.db

# If locked:
rm froggo.db-lock

# If corrupted:
# Restore from backup (loses recent data)
cp ~/clawd/backups/db/froggo-latest.db froggo.db
```

**3. Network Required**
```
Some features need internet on first launch:
- Agent service connection
- Account OAuth flows
- Model downloads

Solution: Ensure stable internet connection
```

---

### Permissions Denied

**Problem:** "Microphone access denied" or similar

**Solutions:**

**System Preferences Fix:**
```
1. System Preferences > Security & Privacy
2. Privacy tab
3. Microphone (left sidebar)
4. Check box next to Froggo
5. Restart Froggo
```

**Reset All Permissions:**
```bash
# Terminal command (requires sudo)
sudo tccutil reset All com.clawdbot.froggo

# Then relaunch app
# Grant permissions when prompted
```

---

## Task & Agent Problems

### Task Stuck "In Progress"

**Problem:** Task hasn't moved in hours, agent seems idle

**Diagnosis:**

```
1. Click task card
2. View "Activity" tab
3. Check last update timestamp
4. If >2 hours: Likely stuck
```

**Solutions:**

**1. Check Agent Logs**
```
Press ⌘6 (Agents panel)
Find agent working on task
Click "View Logs"

Look for:
- Error messages
- "Waiting for..." indicators
- API rate limits
- Unexpected halts
```

**2. Ask Froggo**
```
Press ⌘9 (Chat)
Type: "Why is task-XXX stuck?"

Froggo will:
- Check agent status
- Review error logs
- Suggest solution
- Offer to restart agent
```

**3. Manual Reset**
```
Click task → Actions menu → "Reset to Todo"
Confirms: "This will terminate the agent session"
Click "Reset"

Task returns to Todo
Reassign to agent
Try again
```

**4. Check API Status**
```
Settings > API Usage
Look for:
- Rate limit exceeded
- Authentication errors
- Service outages

If rate limited:
Wait 1 hour and retry
Or upgrade API tier
```

---

### Agent Not Starting

**Problem:** Assign task to agent, nothing happens

**Solutions:**

**1. Verify Agent Service**
```
Press ⌘6 (Agents)
Status should show: "Service Connected ✓"

If disconnected:
Settings > System > "Reconnect Agent Service"
```

**2. Check Task Requirements**
```
Agent won't start if:
- Task has unresolved dependencies
- No description provided
- Assigned to wrong agent type
- Missing required context

Fix:
- Add clear description
- Resolve dependencies
- Verify correct agent chosen
```

**3. Service Restart**
```bash
# Terminal:
~/clawd/scripts/restart-agent-service.sh

# Wait 10 seconds
# Try task assignment again
```

---

### Task Completed but Stuck in Review

**Problem:** Agent finished work, task won't move to Done

**Explanation:**

```
This is intentional workflow:
1. Agent completes → Review status
2. YOU review deliverables
3. You approve → Done status

Review is not automatic!
```

**Solutions:**

**1. Review the Work**
```
Click task card
Review tabs:
- Activity (what agent did)
- Files (deliverables)
- Comments (agent notes)

If satisfied:
Click "Approve" button
Task moves to Done ✓
```

**2. Request Changes**
```
If work isn't good enough:
Click "Request Changes"
Add specific feedback
Task returns to In Progress
Agent addresses feedback
```

**3. Bulk Review**
```
Multiple tasks in Review?
Kanban > Review column
Click "Review All" button
Approve/reject each quickly
```

---

### Subtasks Not Completing

**Problem:** Agent working but subtasks not checking off

**Solutions:**

**1. Manual Completion**
```
Sometimes agents don't auto-check:
Click task details
Subtasks tab
Manually check completed items
Agent continues with next
```

**2. Activity Log Verification**
```
Check Activity tab:
Look for completion messages
Example: "✓ Completed: Research approach"

If message exists but box unchecked:
Bug in UI state
Refresh with ⌘R
```

**3. Agent Feedback**
```
Chat with Froggo:
"Update subtasks for task-XXX based on activity log"

Froggo will sync subtask status
```

---

## Voice Assistant Issues

### Microphone Not Working

**Problem:** Voice panel shows no transcription

**Diagnosis:**

```
Voice panel → Settings → Microphone dropdown
Shows: "No microphone detected" or "Access denied"
```

**Solutions:**

**1. System Permissions**
```
System Preferences > Security & Privacy > Privacy
Microphone → Check Froggo
Restart app
```

**2. Browser Permissions (if web version)**
```
Address bar → Site settings icon
Microphone: Allow
Reload page
```

**3. Hardware Check**
```
Test microphone in another app:
- Voice Memos
- QuickTime audio recording
- FaceTime

If not working elsewhere:
Hardware issue, not Froggo
Check System Preferences > Sound > Input
```

**4. Microphone Selection**
```
Voice panel → Settings
Microphone dropdown
Try different device:
- Built-in Microphone
- External mic
- AirPods
- Bluetooth headset

Click to select, test again
```

---

### Transcription Inaccurate

**Problem:** Voice transcription has many errors

**Solutions:**

**1. Improve Audio Quality**
```
✓ Reduce background noise
✓ Speak directly toward mic
✓ Normal speaking pace (not too fast)
✓ Clear enunciation
✓ Avoid filler words (um, uh)
```

**2. Adjust Sensitivity**
```
Voice Settings > Silence Detection
Try different thresholds:
- Longer threshold = fewer false triggers
- Shorter = more responsive but more errors

Experiment: 1.0s to 2.5s range
```

**3. Model Selection**
```
Voice Settings > Advanced > Model
Options:
- Vosk Small (fast, less accurate)
- Vosk Medium (balanced) ← Default
- Vosk Large (slower, more accurate)

Switch to Large if accuracy critical
Requires ~200 MB download
```

**4. Accent/Language Support**
```
Current model: English (US)

If different accent or language:
Settings > Voice > Language Model
Download appropriate model:
- English (UK)
- English (Australian)
- Other languages

Note: Some accents less supported
```

---

### Voice Response Not Playing

**Problem:** Froggo transcribes but doesn't speak back

**Solutions:**

**1. TTS Enabled?**
```
Voice Settings > Text-to-Speech
Toggle: ON ✓

If already ON:
Try different voice:
- Samantha
- Karen
- Daniel

Test each voice preview
```

**2. System Volume**
```
Check macOS volume:
Menu bar > Volume icon
Not muted
Level >50%

System Preferences > Sound > Output
Correct device selected
```

**3. macOS Speech Settings**
```
System Preferences > Accessibility > Speech
System voice: Should match Froggo TTS selection
Speaking rate: Adjust if too fast/slow
```

**4. Conflicting Apps**
```
Other apps using audio?
- Music, Spotify
- Video calls
- Other voice assistants

Close conflicting apps
Test Froggo TTS again
```

---

### Meeting Eavesdrop Cuts Out

**Problem:** Transcription stops mid-meeting

**Solutions:**

**1. Memory/CPU Issues**
```
Eavesdrop mode is resource-intensive:
Activity Monitor > Froggo process
Check:
- CPU usage (should be <50%)
- Memory (should have 500MB+ free)

If high:
Close other apps
Restart Froggo
Try again
```

**2. Audio Input Switching**
```
macOS sometimes switches mic source:
Voice Settings
Verify correct mic still selected
Lock selection (if available)
```

**3. Background App Quits**
```
macOS can suspend background apps:
System Preferences > Battery > Energy Saver
Prevent App Nap for Froggo
Keep app in foreground during meetings
```

---

## Calendar & Integration Issues

### Calendar Not Syncing

**Problem:** Google Calendar events not appearing

**Diagnosis:**

```
Press ⌘0 (Connected Accounts)
Google Account status:
- ✓ Connected = Auth OK
- ⚠️ Error = Need to reconnect
- 🔄 Syncing = In progress
```

**Solutions:**

**1. Refresh Sync**
```
Connected Accounts > Google account
Click "Refresh" button
Wait 10-30 seconds
Check Dashboard for events
```

**2. Reconnect Account**
```
Connected Accounts > Google account
Click "Disconnect"
Confirm: Yes
Click "+ Add Google Account"
Go through OAuth flow again
Grant all permissions
```

**3. Check Calendar Selection**
```
Connected Accounts > Google account
"Manage Calendars" button
Verify checkboxes:
✓ Primary calendar
✓ Work calendar
✓ Any others you want

Save changes
Refresh sync
```

**4. Permission Issues**
```
Google account might have revoked access:
Visit: myaccount.google.com/permissions
Find: Froggo Dashboard
If missing: Reconnect in app
If present but expired: Revoke and reconnect
```

**5. API Quota**
```
Rare, but possible:
Google Calendar API quota exceeded

Settings > API Usage > Calendar
If quota exceeded:
Wait 24 hours
Or: Use different Google account
```

---

### Events Missing

**Problem:** Some calendar events don't show

**Solutions:**

**1. Filter Settings**
```
Dashboard > Calendar widget > ⚙️
Check filters:
- Show declined events? (probably OFF)
- Date range (might be too narrow)
- Calendar selection (all checked?)

Adjust and save
```

**2. Time Zone Mismatch**
```
Settings > General > Time Zone
Should match: System time zone

If different:
Events appear at wrong times or not at all
Set to "Use system time zone"
```

**3. All-Day Events**
```
All-day events sometimes hidden:
Dashboard > Calendar widget settings
Show all-day events: ON
```

**4. Recurring Events**
```
If recurring event not showing future instances:
Sync issue with recurrence rules
Solution:
1. Disconnect Google account
2. Clear calendar cache (Settings > Advanced)
3. Reconnect account
4. Full sync runs (may take 2-3 minutes)
```

---

### Can't Create Events

**Problem:** "Create Event" button doesn't work

**Solutions:**

**1. Write Permissions**
```
When connecting Google account:
Must grant "Manage calendar" permission
(Not just "View calendar")

Check permissions:
Connected Accounts > Google > Permissions
Should show: "Read and write calendar events"

If only "Read":
Disconnect and reconnect
Grant full permissions
```

**2. Default Calendar Not Set**
```
Settings > Calendar > Default Calendar
Choose which calendar for new events
If blank:
Select primary calendar
Save
```

**3. Approval Queue**
```
New events go to Inbox first!
Press ⌘2
Look for event in approval queue
Approve to create
```

---

## Performance Problems

### App Running Slow

**Problem:** Laggy UI, slow response times

**Solutions:**

**1. Resource Check**
```
Activity Monitor (⌘Space → Activity Monitor)
Find: Froggo
Check:
- CPU: Should be <30% idle, <80% active
- Memory: Should be <500 MB
- Threads: ~20-30 typical

If excessive:
Memory leak or runaway process
Restart app
```

**2. Database Optimization**
```
Settings > Advanced > Optimize Database
Runs VACUUM and ANALYZE on SQLite
Compacts database, rebuilds indexes
Can take 1-2 minutes
Performance improvement: 20-40%
```

**3. Clear Old Data**
```
Settings > Data & Privacy > Clean Up
Options:
- Delete completed tasks >90 days old
- Clear message cache >30 days
- Remove old session logs

Select options, confirm
Reduces database size = faster queries
```

**4. Reduce Visual Effects**
```
Settings > Appearance > Animations
Reduce or disable:
- Panel transitions
- Loading animations
- Particle effects
- Blur effects

Improves performance on older Macs
```

**5. Close Unused Panels**
```
Keep only necessary panels open:
⌘1-9 to navigate
Close panels not in use
Especially: Voice, Agents (resource-heavy)
```

---

### High CPU Usage

**Problem:** Froggo using 100% CPU constantly

**Diagnosis:**

```
Activity Monitor > Froggo > ⓘ (Info)
Sample process
Look for hot functions in stack trace
```

**Solutions:**

**1. Voice Panel**
```
Voice transcription = CPU intensive
If not using:
Close voice panel (⌘8, then close)
Or: Stop transcription (click orb/phone icon)
```

**2. Agent Sessions**
```
Multiple active agents = high CPU
Press ⌘6
Terminate idle/completed sessions
Keep only necessary agents active
```

**3. Infinite Loop Detection**
```
Rare bug: Agent stuck in loop
Indicators:
- Same log message repeating
- CPU pegged at 100%
- No progress

Fix:
Press ⌘6
Find agent with high CPU
Terminate session
Report bug
```

**4. Background Sync**
```
Initial sync of Google data = CPU spike
Normal: 2-5 minutes
Check: ⌘0 > Account sync status
Wait for "Synced ✓"
```

---

### Memory Leaks

**Problem:** Memory usage grows over time, never decreases

**Solutions:**

**1. Regular Restarts**
```
Restart Froggo daily or after heavy use
⌘Q to quit
Relaunch
Clears memory leaks
```

**2. Report Leak**
```
Settings > Support > Report Bug
Describe:
- Memory started at: __ MB
- Grew to: __ MB
- Time elapsed: __ hours
- Actions performed

Helps development team fix leaks
```

**3. Workaround**
```
Until fixed:
Set up cron job to restart nightly:
```bash
# crontab -e
0 3 * * * killall Froggo && open -a Froggo
```
Restarts at 3 AM daily
Prevents memory from growing indefinitely
```

---

## Data & Sync Issues

### Data Not Saving

**Problem:** Create task, close app, task is gone

**Solutions:**

**1. Database Write Permissions**
```bash
# Check permissions:
ls -l ~/clawd/data/froggo.db

# Should be writable:
-rw-r--r--

# If not:
chmod 644 ~/clawd/data/froggo.db
```

**2. Disk Space**
```bash
# Check free space:
df -h ~

# Need at least 100 MB free
# If low on space:
# Clean up large files
# Empty trash
# Delete old Time Machine snapshots
```

**3. Database Lock**
```
Another process might have database locked:
```bash
# Check for lock file:
ls ~/clawd/data/*.db-lock

# If exists:
rm ~/clawd/data/*.db-lock

# Restart Froggo
```

**4. Verify Auto-Save**
```
Settings > General > Auto-Save
Should be: ON ✓

If off:
Tasks only save when you click "Save"
Turn on for automatic saving
```

---

### Lost Data After Update

**Problem:** Updated app, lost tasks/messages

**Solutions:**

**1. Check Backups**
```
Settings > Data & Privacy > Restore from Backup
Look for backup before update
Restore if needed
```

**2. Migration Issue**
```
Database schema changed between versions:
Settings > System > Run Migration
Attempts to migrate old database
May recover lost data
```

**3. Export Before Update (Prevention)**
```
Best practice:
Before ANY update:
1. Settings > Data & Privacy > Export All
2. Store backup safely
3. Then update
4. If issue: Restore backup
```

---

### Sync Conflicts

**Problem:** "Sync conflict detected" error

**Solutions:**

**1. Choose Version**
```
Conflict dialog shows:
- Local version (your device)
- Remote version (cloud/other device)

Choose which to keep:
- Local: Overwrites remote
- Remote: Overwrites local
- Merge: Attempts automatic merge (risky)

Recommendation: Local (safer)
```

**2. Prevent Conflicts**
```
Conflicts occur when:
- Multiple devices editing same data
- Offline edits + online edits

Prevent:
- Use one device at a time
- Ensure good internet
- Wait for sync to complete before switching devices
```

---

## UI & Display Issues

### Blank White Screen

**Problem:** App loads but shows white screen

**Solutions:**

**1. Force Refresh**
```
Press: ⌘R (force reload)
Or: ⌘Q (quit) and relaunch
```

**2. Clear Render Cache**
```bash
# Terminal:
rm -rf ~/Library/Caches/com.clawdbot.froggo/*
# Relaunch app
```

**3. GPU Acceleration**
```
Settings > Advanced > Hardware Acceleration
Toggle: OFF
Restart app
Uses CPU rendering instead of GPU
Slower but more compatible
```

---

### Text Not Rendering

**Problem:** Boxes appear but no text visible

**Solutions:**

**1. Font Issue**
```
Settings > Appearance > Font
Reset to default: "System Font"
Restart app
```

**2. Color Contrast**
```
Settings > Appearance > Theme
Try different theme:
- Dark mode
- Light mode
- High contrast

One may have better text visibility
```

---

### Layout Broken

**Problem:** UI elements overlapping or misaligned

**Solutions:**

**1. Window Resize**
```
Make window smaller, then larger
Forces layout recalculation
Or: Double-click title bar (minimize/maximize)
```

**2. Reset Layout**
```
Settings > Appearance > Reset Layout
Restores default panel positions and sizes
```

**3. Zoom Reset**
```
View > Actual Size
Or: ⌘0
Resets zoom to 100%
Fixes scaling issues
```

---

## Error Messages Decoded

### "NO ACTIVE TASK CONTEXT"

**Meaning:** Operation requires a task to be selected/active

**Fix:**
```
1. Create or select a task first
2. Then perform the operation
3. Or: Set task context if you're working on one
```

---

### "Agent Session Failed to Spawn"

**Meaning:** Couldn't start the agent process

**Causes:**
- No internet connection
- API credentials invalid
- Rate limit exceeded
- Service outage

**Fix:**
```
1. Check internet connection
2. Settings > API > Verify credentials
3. Wait if rate limited
4. Check status.anthropic.com for outages
```

---

### "Permission Denied"

**Meaning:** Froggo lacks system permissions

**Fix:**
```
System Preferences > Security & Privacy > Privacy
Grant required permission:
- Microphone (for voice)
- Notifications (for alerts)
- Full Disk Access (for file operations)
Restart Froggo
```

---

### "Database Locked"

**Meaning:** Another process is using the database

**Fix:**
```bash
# Find and kill locks:
lsof ~/clawd/data/froggo.db
# Kill those process IDs

# Or force remove lock:
rm ~/clawd/data/*.db-lock

# Restart Froggo
```

---

### "Rate Limit Exceeded"

**Meaning:** Too many API requests in short time

**Fix:**
```
1. Wait 1 hour (rate limit resets)
2. Settings > API Usage to check quota
3. Reduce agent activity temporarily
4. Or: Upgrade API tier for higher limits
```

---

### "Sync Conflict"

**Meaning:** Local and remote data don't match

**Fix:**
```
Conflict dialog appears
Choose:
- Keep Local (safest)
- Keep Remote (if you trust it)
- Merge (risky)

To prevent:
Use one device at a time
```

---

### "Vosk Model Not Found"

**Meaning:** Voice recognition model missing

**Fix:**
```
1. Voice panel will auto-download on first use
2. Wait for "Downloading... (45 MB)"
3. If fails:
   Settings > Voice > Advanced > Reinstall Model
4. Requires internet connection
```

---

## Advanced Troubleshooting

### Reset to Factory State

**Nuclear option - use only if everything else fails**

**⚠️ WARNING: Erases all data! Export first!**

```bash
# 1. Export data first!
Settings > Data & Privacy > Export All Data

# 2. Quit Froggo
# ⌘Q

# 3. Delete all app data:
rm -rf ~/Library/Application\ Support/Froggo
rm -rf ~/Library/Caches/com.clawdbot.froggo
rm -rf ~/Library/Preferences/com.clawdbot.froggo.plist
rm -rf ~/clawd/data/froggo.db

# 4. Relaunch Froggo
# Fresh install state
# Go through setup again
```

---

### Enable Debug Mode

**For development team troubleshooting**

```bash
# Set debug environment variable:
export FROGGO_DEBUG=1

# Launch from terminal:
open -a Froggo

# Or set permanently:
# Add to ~/.zshrc:
export FROGGO_DEBUG=1

# Enables:
- Verbose logging
- Developer tools (⌘⌥I)
- Performance metrics
- Database query logging
```

---

### Collect Diagnostic Info

**For support tickets**

```
Settings > Support > Generate Diagnostic Report

Includes:
✓ System info (OS, RAM, CPU)
✓ Error logs (last 24 hours)
✓ Database stats
✓ API usage metrics
✓ Performance data
✗ NO personal data (privacy-safe)

Creates: diagnostic-report-YYYY-MM-DD.zip

Attach to support ticket for faster resolution
```

---

### Database Corruption Recovery

**If database is corrupted beyond repair**

```bash
# 1. Stop Froggo

# 2. Backup corrupted database:
cp ~/clawd/data/froggo.db ~/clawd/data/froggo.db.corrupted

# 3. Try repair:
sqlite3 ~/clawd/data/froggo.db ".recover" | sqlite3 ~/clawd/data/froggo-repaired.db

# 4. Replace:
mv ~/clawd/data/froggo-repaired.db ~/clawd/data/froggo.db

# 5. Relaunch Froggo

# If repair fails:
# Restore from latest backup
cp ~/clawd/backups/db/latest.db ~/clawd/data/froggo.db
```

---

## Getting Help

### Self-Help Resources

1. **In-App Help** (`⌘?`)
   - Searchable documentation
   - FAQ section
   - Context-aware help

2. **Ask Froggo** (`⌘9`)
   - Chat with Froggo about issues
   - "Why is task-XXX stuck?"
   - "Voice transcription not working"

3. **Video Tutorials**
   - https://youtube.com/@froggo
   - Visual walkthroughs
   - Common problem solutions

### Community Support

4. **Discord Community**
   - https://discord.gg/froggo
   - Ask other users
   - Share tips and tricks
   - #troubleshooting channel

5. **GitHub Issues**
   - https://github.com/froggo/dashboard
   - Bug reports
   - Feature requests
   - Known issues list

### Official Support

6. **Email Support**
   - support@froggo.ai
   - Response time: 24-48 hours
   - Include diagnostic report

7. **Live Chat** (Premium users)
   - Settings > Support > Live Chat
   - Real-time assistance
   - Screen sharing available

---

## Preventive Maintenance

**Avoid issues before they happen:**

### Daily
- ✓ Review agent activity (⌘6)
- ✓ Clear completed tasks (archive)
- ✓ Check sync status (⌘0)

### Weekly
- ✓ Restart Froggo (clear memory leaks)
- ✓ Review error logs (Settings > System)
- ✓ Update app if available
- ✓ Verify backups exist

### Monthly
- ✓ Export data (Settings > Data & Privacy)
- ✓ Optimize database (Settings > Advanced)
- ✓ Clean up old data (>90 days)
- ✓ Review API usage and costs

### Quarterly
- ✓ Full system backup
- ✓ Review and update integrations
- ✓ Audit permissions (⌘0)
- ✓ Update all connected accounts

---

## Still Having Issues?

If this guide didn't solve your problem:

1. **Search the FAQ** (`⌘?` → FAQ tab)
2. **Ask in Chat** (`⌘9` → describe problem)
3. **Check Status Page** (status.froggo.ai)
4. **Discord #troubleshooting** (community help)
5. **Email Support** (with diagnostic report)

**Remember:** Export your data regularly! 
Settings > Data & Privacy > Export All Data

---

**Document Version:** 1.0  
**Last Updated:** January 29, 2026  
**Covers:** Froggo Dashboard v0.1.0+
