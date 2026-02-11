# Floating Toolbar User Guide

The **Floating Toolbar** (QuickActions component) provides quick access to key features from anywhere in the dashboard. It's draggable, collapsible, and packed with 4 major feature sets.

---

## 🎯 Core Features

### 1. **Meeting Icon & Navigation** 🎥

**Icon:** Video camera icon (replaces old Zap/lightning icon)

**Behavior:**
- **Not in meeting:** Click → Start meeting + Navigate to meetings tab
- **Already in meeting:** Click → Navigate to meetings tab (meeting stays active)

**Visual States:**
- 🟢 **Green pulsing** = Meeting active
- 🔵 **Blue/Accent** = No meeting (ready to start)

**Use case:** Instant meeting access from any screen — Analytics, Kanban, Settings — just click and you're in.

---

### 2. **Voice Call System** ☎️

**Icon:** Phone icon (turns RED with line-through during active calls)

**Features:**
- **Agent Selection Modal:** Choose which agent to call (Froggo, Coder, Chief, etc.)
- **Call Persistence:** Stay connected when switching tabs/views
- **Visual Feedback:**
  - Normal state: Gray phone icon
  - Active call: **RED background + white diagonal line-through**
  - Agent name badge: Shows who you're calling (e.g., "Coder")

**How to use:**
1. Click phone icon → Agent selection modal opens
2. Pick an agent (each shows name, role, avatar)
3. Call starts, icon turns RED with line-through
4. Navigate anywhere — call persists
5. Click phone icon again to end call or switch agents

**Storage:** Active call state saved to localStorage (`quickActions_activeCall`) — persists across refreshes!

---

### 3. **Context-Aware Agent Chat** ✨

**Icon:** Sparkles icon

**Smart Feature:** Suggests relevant agents based on your current view!

**Examples:**
- **Analytics view** → Suggests: Coder, Researcher, Chief
- **Kanban/Tasks** → Suggests: Chief, Coder, Clara
- **Twitter** → Suggests: Social Manager, Growth Director, Writer
- **Settings** → Suggests: Coder, Lead Engineer, Froggo

**How to use:**
1. Click sparkles icon → Context chat modal opens
2. See current context highlighted (e.g., "Analytics")
3. Suggested agents shown first (based on context)
4. Type message (e.g., "Explain this data spike")
5. Context automatically prepended: `[Context: viewing Analytics] Explain this data spike`
6. Agent receives message with full context

**Shortcuts:**
- Click "More..." to see all agents
- ⌘+Enter or Ctrl+Enter to send

---

### 4. **Task Status Shortcuts** 📋

**Icon:** List/Todo icon

**Features:**
- View recent in-progress tasks (up to 5)
- Quick status updates: To Do → In Progress → Review → Done
- No need to open full Kanban board

**How to use:**
1. Click list icon → Task shortcuts modal opens
2. See your active tasks
3. Click status button to move task (e.g., "In Progress" → "Review")
4. Toast notification confirms update
5. Kanban board reflects changes instantly

**Status Options:**
- ⬜ **To Do** (gray)
- ▶️ **In Progress** (blue)
- 🔍 **Review** (yellow)
- ✅ **Done** (green)

---

## 🎨 Toolbar Features

### **Draggable Positioning**
- Grab the **grip icon** (⋮⋮) on the left
- Drag toolbar anywhere
- Release → Snaps to nearest corner:
  - Bottom-right
  - Bottom-left
  - Top-right
  - Top-left
- Position saved to localStorage

### **Collapse/Expand**
- Click **chevron icon** (< or >) to collapse
- Collapsed view shows only:
  - Meeting icon
  - Active call badge (if in call)
  - Expand button
- State persisted across sessions

### **Reset Position**
- Click **circular arrow icon** (↻)
- Toolbar returns to default position (bottom-right)

### **Other Quick Actions**
- 🔍 **Search** (⌘/)
- ➕ **New Task**
- 👤 **Add Contact** (⌘⇧N)
- 🧠 **Add Skill** (⌘⇧K)
- 💬 **Quick Message** (send to Froggo)
- ✅ **Approve All Pending**

### **Voice Controls**
- 🎤 **Mic** — Mute/Unmute (⌘M)
- Shows **"Live"** badge when meeting active
- Shows **agent name** badge when in agent call (e.g., "Coder")

---

## 🧠 Architecture Notes (for developers)

### **Component Structure**
```
QuickActions.tsx
├── Main Toolbar (draggable, collapsible)
├── AgentCallModal (FEATURE 2)
├── ContextChatModal (FEATURE 3)
└── TaskShortcutsModal (FEATURE 4)
```

### **State Management**
- **Zustand store** (`useStore`):
  - `isMuted`, `toggleMuted`
  - `isMeetingActive`, `toggleMeeting`
- **localStorage**:
  - `quickActionsState` — toolbar position & collapse state
  - `quickActions_activeCall` — persistent call state

### **Props Required**
```tsx
<QuickActions
  onNewTask={() => void}
  onSearch={() => void}
  onApproveAll={() => void}
  onAddContact={() => void}
  onAddSkill={() => void}
  onNavigate={(view: string) => void}  // REQUIRED for FEATURE 1 & 3
  currentView={string}                  // REQUIRED for FEATURE 3
/>
```

### **Agent Suggestions Map**
See `VIEW_AGENT_SUGGESTIONS` constant in component — maps each view to 3 suggested agents.

### **API Integrations**
- **Chat API:** `POST /api/chat` — send messages to agents
- **Tasks API:** `GET /api/tasks?status=in-progress` — fetch active tasks
- **Task Update API:** `PATCH /api/tasks/:id/status` — update task status

---

## 📝 Implementation Checklist (completed)

✅ 1. Audit current FloatingToolbar component  
✅ 2. Design meeting icon and interaction flow  
✅ 3. Build agent selection modal for voice calls  
✅ 4. Implement call persistence across navigation  
✅ 5. Add RED icon with line-through for active calls  
✅ 6. Implement context-aware agent chat routing  
✅ 7. Build task status shortcuts in toolbar  
✅ 8. Integrate all 4 features into cohesive toolbar  
⏳ 9. Test all features (in progress)  
⏳ 10. Documentation (this file!)

---

## 🚀 Usage Tips

**Power User Moves:**
1. **Analytics Deep Dive:** Switch to Analytics → Click sparkles → Ask Coder "What's the biggest bottleneck?"
2. **Quick Task Update:** Middle of a call → Click list icon → Move task to Review without leaving
3. **Multi-Agent Calls:** Switch between agents without ending meeting (keeps meeting active, just changes agent context)
4. **Context Handoffs:** In Settings debugging an issue → Context chat with Lead Engineer "Need help with this config"

**Keyboard Shortcuts:**
- ⌘/ — Search
- ⌘M — Mute/Unmute
- ⌘⇧N — Add Contact
- ⌘⇧K — Add Skill
- ⌘+Enter in modals — Send/Submit

---

## 🐛 Known Limitations

1. **Task API:** Currently mocked endpoint for status updates (needs backend integration)
2. **Call Audio:** Visual state only — actual WebRTC/audio handled by VoiceChatPanel
3. **Agent Context:** Context string is prepended to message but agent must parse it

---

## 🔮 Future Enhancements

- [ ] Voice call recording indicator
- [ ] Recent agents list (call history)
- [ ] Task creation from toolbar
- [ ] Custom toolbar layout (pin/unpin actions)
- [ ] Notification badges on icons
- [ ] Toolbar themes (dark/light/custom colors)

---

**Version:** 1.0.0 (Feb 2026)  
**Component:** `src/components/QuickActions.tsx`  
**Task ID:** task-1770025480117
