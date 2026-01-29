# Froggo Dashboard - Quick Reference Card

**Print this and keep it near your desk!**

---

## 🚀 Essential Shortcuts (Learn These First!)

| Shortcut | Action |
|----------|--------|
| `⌘K` | **Search Everything** (Command Palette) |
| `⌘1` - `⌘9` | **Switch Panels** (Dashboard → Chat) |
| `⌘?` | **Help** (This guide & keyboard shortcuts) |
| `⌘,` | **Settings** (Preferences & configuration) |

---

## 📱 Panel Navigation (⌘ + Number)

```
⌘1  Dashboard       🏠  Your command center
⌘2  Inbox           📥  Approval queue
⌘3  Comms           💬  Messages (all channels)
⌘4  Analytics       📊  Productivity metrics
⌘5  Kanban          📋  Task board
⌘6  Agents          🤖  Agent monitoring
⌘7  X/Twitter       🐦  Social media
⌘8  Voice           🎙️  Voice assistant
⌘9  Chat            💭  Talk to Froggo
⌘0  Accounts        🔗  Connected services
```

---

## ✅ Task Management (in Kanban, ⌘5)

| Action | Shortcut |
|--------|----------|
| New task | `N` |
| Task details | `⌘I` |
| Edit task | `⌘E` |
| Complete task | `⌘Enter` |
| Star/bookmark | `⌘B` |
| Duplicate | `⌘D` |
| Delete | `⌘⇧D` |
| Navigate | `↑↓←→` |

---

## 📥 Inbox Navigation (⌘2)

```
J       Next item      ↓
K       Previous item  ↑
A       Approve        ✅
R       Reject         ❌
X       Defer          ⏸️
E       Edit           ✏️
⌘⇧A     Approve all    ✅✅✅
```

**Goal:** Process 30+ items/minute!

---

## 🎤 Voice Commands (⌘8)

**Conversation Mode (Frog Orb):**
- Click orb → Speak → Auto-sends after 2s silence → Froggo responds → Repeat

**Meeting Mode (Phone Icon):**
- Click phone → Continuous transcription → Click "Send Summary" when done

**Quick Commands:**
- "What's on my calendar today?"
- "Create a task to [description]"
- "Show my inbox"
- "How many tasks did I complete?"

---

## 🤖 Agent Types

| Agent | Icon | Use For |
|-------|------|---------|
| Coder | 💻 | Code, debugging, git, tech tasks |
| Writer | ✍️ | Content, docs, social, emails |
| Researcher | 🔍 | Research, analysis, summaries |
| Chief | 👨‍💻 | Complex projects (spawns sub-agents) |

---

## 🎯 Priority Levels

```
P0 🔴  Critical    Production down, security breach
                  Fix IMMEDIATELY (<1% of tasks)

P1 🟠  High        Important features, customer blocked
                  Complete THIS WEEK (~10% of tasks)

P2 🟡  Medium      Normal work, minor bugs
                  Complete THIS MONTH (~70% of tasks)

P3 🟢  Low         Nice-to-have, backlog
                  Flexible timeline (~20% of tasks)
```

**Rule:** If everything is P0, nothing is P0!

---

## 🔍 Search Syntax (⌘K)

```
"exact phrase"          Find exact match
task:login             Search tasks only
agent:coder            By agent
status:in-progress     By status
priority:p0            By priority
date:2026-01-28        By date
from:writer            By creator
tag:frontend           By tag
```

---

## 📝 Task Workflow

```
┌──────┐
│ TODO │  Created, waiting to be picked up
└──────┘
   ↓
┌─────────────┐
│ IN PROGRESS │  Agent actively working
└─────────────┘
   ↓
┌────────┐
│ REVIEW │  YOU review & approve deliverables
└────────┘
   ↓
┌──────┐
│ DONE │  Complete! 🎉
└──────┘
```

---

## 💡 Pro Tips

```
✓ Use J/K navigation in inbox (vim-style)
✓ Command Palette (⌘K) for everything
✓ Voice dictation (⌘⇧V) for quick tasks
✓ Star important messages (⌘S in inbox)
✓ Snooze conversations (moon icon)
✓ Folders organize messages by project
✓ Markdown works everywhere (**bold**, *italic*)
✓ Drag & drop tasks between columns
✓ Edit before approving (press E in inbox)
✓ Approve all similar items (⌘⇧A)
```

---

## 🆘 Troubleshooting

**Agent Stuck?**
1. Check activity log
2. Ask Froggo: "Why is task-XXX stuck?"
3. Reset to Todo and reassign

**Voice Not Working?**
1. Check mic permissions (System Preferences)
2. Select correct mic (Voice settings)
3. Download Vosk model (auto-downloads first use)

**Calendar Not Syncing?**
1. Connected Accounts (⌘0)
2. Click "Refresh" on Google account
3. Verify permissions granted

**App Running Slow?**
1. Restart Froggo (⌘Q, relaunch)
2. Optimize database (Settings > Advanced)
3. Clear old data (Settings > Data & Privacy)

---

## 🎓 Learning Path

**Week 1: Basics**
- [ ] Master panel navigation (⌘1-9)
- [ ] Use Command Palette (⌘K) daily
- [ ] Create 5 tasks, assign to agents
- [ ] Process inbox with keyboard (J/K/A)

**Week 2: Efficiency**
- [ ] Learn inbox bulk operations
- [ ] Try voice assistant
- [ ] Customize keyboard shortcuts
- [ ] Use markdown in descriptions

**Week 3: Advanced**
- [ ] Set up auto-approval rules
- [ ] Create task templates
- [ ] Use folders for organization
- [ ] Master voice eavesdrop mode

**Week 4: Mastery**
- [ ] Keyboard-only challenge (no mouse!)
- [ ] Process 50+ inbox items in 2 minutes
- [ ] Teach someone else
- [ ] Build your own workflow

---

## 📊 Daily Workflow Example

**Morning (15 min):**
```
⌘1  Check dashboard (calendar, stats)
⌘2  Approve overnight agent work
⌘5  Review kanban, plan priorities
⌘8  Voice: "What's my top priority today?"
```

**During Day:**
```
⌘6  Monitor agent progress (every hour)
⌘3  Respond to messages
⌘K  Search for anything needed
⌘8  Use voice for quick tasks/meetings
```

**End of Day (10 min):**
```
⌘2  Final inbox sweep
⌘5  Complete tasks, move to Done
⌘4  Check analytics
     Export data (Settings > Data & Privacy)
```

---

## 🔒 Privacy & Security

✅ **Voice transcription:** 100% local (Vosk), no cloud  
✅ **Your data:** Stored locally in SQLite  
✅ **Agent conversations:** Through Claude API (Anthropic)  
✅ **Export anytime:** Settings > Data & Privacy  
✅ **You own your data:** Delete anytime  

---

## 🆘 Getting Help

| Method | Best For | Speed |
|--------|----------|-------|
| `⌘?` | Built-in help | Instant |
| `⌘9` + "Ask Froggo" | Quick questions | Seconds |
| Discord | Community help | Minutes |
| support@froggo.ai | Official support | 24-48h |

---

## ⌨️ The Essential 10 Shortcuts

**Master these, you'll be 80% faster:**

```
⌘K        Search everything
⌘1-9      Navigate panels
⌘?        Get help
⌘,        Settings
N         Create new (context-aware)
⌘Enter    Complete/Submit
J/K       Navigate up/down
A/R       Approve/Reject
⌘S        Save
Esc       Cancel/Close
```

---

## 📱 Mobile Access

**Coming soon!** Currently desktop-only.

**Workaround:** Mobile browser (responsive) works for viewing. Full features require desktop.

---

## 🎉 Fun Facts

- Voice assistant processes **100% locally** (no cloud!)
- Agents can complete **80% of routine tasks** automatically
- Average user saves **10+ hours/week** with Froggo
- Keyboard navigation is **3-5x faster** than mouse
- The frog orb animation has **42 frames** (a nod to Douglas Adams)

---

## 📚 Learn More

**Documentation:**
- Complete User Guide: `docs/USER_GUIDE.md`
- Feature Walkthroughs: `docs/FEATURE_WALKTHROUGHS.md`
- Troubleshooting: `docs/TROUBLESHOOTING_GUIDE.md`
- Keyboard Reference: `docs/KEYBOARD_SHORTCUTS_REFERENCE.md`

**In-App:**
- Press `⌘?` for interactive help
- Press `⌘K` to search docs
- Ask Froggo anything in Chat (`⌘9`)

---

**Version:** 1.0  
**Last Updated:** January 29, 2026  
**Platform:** macOS  

**Happy Frogging! 🐸**

---

## 🖨️ Print-Friendly Version

**To print this card:**
1. Save as PDF: File > Print > Save as PDF
2. Print: Single-sided, portrait
3. Laminate for durability (optional)
4. Keep near desk for quick reference

**Or:** Download printable PDF: Settings > Help > Quick Reference Card
