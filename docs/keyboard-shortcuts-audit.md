# Keyboard Shortcuts Audit & Standardization

**Date:** 2026-01-29  
**Status:** Complete Audit → Implementation in Progress

## Current Shortcuts (Documented)

### Global Navigation (⌘1-9, ⌘0)
| Shortcut | Action | Status |
|----------|--------|--------|
| ⌘1 | Dashboard | ✅ Implemented |
| ⌘2 | Inbox (Approvals) | ✅ Implemented |
| ⌘3 | Comms Inbox | ✅ Implemented |
| ⌘4 | Analytics | ✅ Implemented |
| ⌘5 | Tasks (Kanban) | ✅ Implemented |
| ⌘6 | Agents | ✅ Implemented |
| ⌘7 | X/Twitter | ✅ Implemented |
| ⌘8 | Voice | ✅ Implemented |
| ⌘9 | Chat | ✅ Implemented |
| ⌘0 | Connected Accounts | ✅ Implemented |

### Global Actions
| Shortcut | Action | Status |
|----------|--------|--------|
| ⌘K | Command Palette | ✅ Implemented |
| ⌘/ | Global Search | ✅ Implemented |
| ⌘, | Settings | ✅ Implemented |
| ⌘? (⌘⇧/) | Keyboard Shortcuts Help | ✅ Implemented |
| ⌘M | Toggle Mute | ✅ Implemented |
| ⌘⇧M | Quick Message | ✅ Implemented |
| ⌘⇧N | Add Contact | ✅ Implemented |
| ⌘⇧K | Add Skill | ✅ Implemented |
| ⌘⇧C | Context Control Board | ✅ Implemented |
| ⌘⇧D | Code Agent Dashboard | ✅ Implemented |
| ⌘⇧L | Library | ✅ Implemented |
| ⌘⇧S | Schedule | ✅ Implemented |
| Esc | Close Modal/Panel | ✅ Implemented |

### Panel-Specific Shortcuts

#### Kanban Panel
| Shortcut | Action | Status |
|----------|--------|--------|
| n | New Task | ✅ Implemented |
| ? | Show Keyboard Help | ✅ Implemented |
| ⌘F | Show Filters | ✅ Implemented |
| Esc | Clear Selection/Close Filters | ✅ Implemented |

#### Inbox Panel (Approvals)
| Shortcut | Action | Status |
|----------|--------|--------|
| j | Next Item | ✅ Implemented |
| k | Previous Item | ✅ Implemented |
| a | Approve Focused Item | ✅ Implemented |
| r | Reject Focused Item | ✅ Implemented |
| x | Defer Focused Item | ✅ Implemented |

#### Chat/Voice Panels
| Shortcut | Action | Status |
|----------|--------|--------|
| Enter | Send Message | ✅ Implemented |
| ⌘Enter | Send Message | ✅ Implemented |
| ⇧Enter | New Line | ✅ Implemented |

#### Task Detail Panel
| Shortcut | Action | Status |
|----------|--------|--------|
| Enter (in subtask input) | Add Subtask | ✅ Implemented |

---

## Missing Standard Shortcuts (To Implement)

### Standard Actions (Missing)
| Shortcut | Expected Action | Priority | Panel(s) |
|----------|----------------|----------|----------|
| ⌘N | New (Task/Tweet/etc) | 🔴 High | Kanban, XPanel, All |
| ⌘S | Save/Submit | 🔴 High | TaskModal, XPanel, Forms |
| ⌘E | Edit Selected | 🟡 Medium | Kanban, Inbox |
| ⌘D | Delete/Archive | 🟡 Medium | Kanban, Inbox |
| ⌘R | Refresh/Reload | 🟡 Medium | All Panels |
| ⌘⇧D | Duplicate | 🟢 Low | Kanban, TaskModal |
| ⌘Z | Undo | 🟢 Low | Editors |
| ⌘⇧Z | Redo | 🟢 Low | Editors |
| ⌘A | Select All | 🟢 Low | Lists |
| ⌘F | Find/Filter | 🔴 High | All Panels |
| ⌘P | Print/Preview | 🟢 Low | TaskDetail |

### Navigation Enhancements (Missing)
| Shortcut | Expected Action | Priority | Panel(s) |
|----------|----------------|----------|----------|
| ⌘] | Next Panel/Tab | 🟡 Medium | TaskDetail, All |
| ⌘[ | Previous Panel/Tab | 🟡 Medium | TaskDetail, All |
| ⌘↑ | First Item | 🟡 Medium | Lists |
| ⌘↓ | Last Item | 🟡 Medium | Lists |
| →/← | Navigate Tabs (in detail views) | 🟡 Medium | TaskDetail |
| Tab | Focus Next Field | 🔴 High | Forms |
| ⇧Tab | Focus Previous Field | 🔴 High | Forms |

### Task-Specific Shortcuts (Missing)
| Shortcut | Expected Action | Priority | Panel(s) |
|----------|----------------|----------|----------|
| ⌘Enter | Complete Task | 🔴 High | TaskDetail |
| ⌘B | Bookmark/Star Task | 🟡 Medium | TaskDetail |
| ⌘I | Open Task Info/Details | 🟡 Medium | Kanban |
| ⌘⇧C | Copy Task Link | 🟡 Medium | TaskDetail |
| ⌘⇧V | Paste as Subtask | 🟢 Low | TaskDetail |

### X/Twitter Shortcuts (Missing)
| Shortcut | Expected Action | Priority | Panel(s) |
|----------|----------------|----------|----------|
| ⌘N | New Tweet | 🔴 High | XPanel |
| ⌘Enter | Send Tweet | 🔴 High | XPanel |
| ⌘⇧R | Retweet | 🟡 Medium | XPanel |
| ⌘L | Like | 🟡 Medium | XPanel |
| ⌘⇧B | Bookmark | 🟡 Medium | XPanel |

---

## Conflicts to Resolve

| Shortcut | Conflict | Resolution |
|----------|----------|------------|
| n (Kanban) vs ⌘N (New) | Different scopes | ✅ OK - 'n' is panel-only, ⌘N is global |
| ⌘M (Mute) vs ⌘⇧M (Quick Message) | Different modifiers | ✅ OK - Clear distinction |
| ⌘D (Delete?) vs ⌘⇧D (Code Agent) | Would conflict if both used | ⚠️ Use ⌘⌫ for delete instead |

**Recommended Delete Shortcuts:**
- ⌘⌫ (Cmd+Backspace) - Standard macOS delete
- ⌘⇧⌫ - Force delete (skip confirmation)

---

## Implementation Plan

### Phase 1: Core Actions (Priority: 🔴 High)
- [ ] ⌘N - New item in current context
- [ ] ⌘S - Save/Submit in modals/forms
- [ ] ⌘F - Find/Filter (standardize across panels)
- [ ] ⌘Enter - Complete/Submit in task contexts
- [ ] Tab/⇧Tab - Proper form navigation

### Phase 2: Standard Navigation (Priority: 🟡 Medium)
- [ ] ⌘]/⌘[ - Panel/tab navigation
- [ ] ⌘↑/⌘↓ - Jump to first/last
- [ ] →/← - Tab navigation in detail views
- [ ] ⌘E - Edit selected item
- [ ] ⌘⌫ - Delete/archive selected

### Phase 3: Advanced Features (Priority: 🟢 Low)
- [ ] ⌘⇧D - Duplicate task
- [ ] ⌘B - Bookmark/star
- [ ] ⌘⇧C - Copy link
- [ ] ⌘R - Refresh
- [ ] ⌘Z/⌘⇧Z - Undo/redo

### Phase 4: UI Enhancements
- [ ] Add shortcut hints to all buttons (tooltips)
- [ ] Update KeyboardShortcuts.tsx with all new shortcuts
- [ ] Add keyboard help overlay per panel (? key)
- [ ] Visual feedback when shortcut is triggered

---

## Shortcut Design Principles

1. **Consistency First**
   - ⌘N always creates new
   - ⌘S always saves/submits
   - ⌘F always finds/filters
   - Escape always closes/cancels

2. **Context Awareness**
   - Shortcuts adapt to current panel
   - Don't trigger when typing in inputs
   - Clear visual feedback

3. **Discoverability**
   - Show shortcuts in tooltips
   - ? key shows panel-specific help
   - ⌘? shows global shortcuts

4. **macOS Standards**
   - Follow macOS conventions
   - ⌘ for primary actions
   - ⌘⇧ for variations/advanced
   - ⌘⌥ for utility actions

5. **Accessibility**
   - All actions keyboard-accessible
   - No keyboard traps
   - Focus visible and logical

---

## Testing Checklist

- [ ] All shortcuts work without conflicts
- [ ] Shortcuts don't trigger while typing
- [ ] Focus management is correct
- [ ] Visual feedback on activation
- [ ] Tooltips show correct shortcuts
- [ ] Help panels are accurate
- [ ] Works on macOS (⌘) and Windows (Ctrl)
- [ ] No regression on existing shortcuts

---

## Next Steps

1. ✅ Document current state (this file)
2. ⏳ Implement Phase 1 shortcuts
3. ⏳ Update KeyboardShortcuts.tsx component
4. ⏳ Add tooltips to buttons
5. ⏳ Test for conflicts
6. ⏳ Update user documentation
