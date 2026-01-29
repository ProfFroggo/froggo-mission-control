# Keyboard Shortcuts Specification

**Status:** Implementation in progress  
**Task ID:** task-1769656021545  
**Date:** 2026-01-29

## Design Principles

1. **⌘ (Cmd) Consistency** - All global shortcuts use ⌘
2. **Panel-Specific** - Single-key shortcuts (like `N`, `A`, `R`) work within their panel context
3. **Discoverable** - Show shortcuts in UI tooltips and help modal
4. **Standard Conventions** - Follow macOS/web app standards (⌘S = Save, ⌘K = Search, etc.)

---

## Current Shortcuts (Existing)

### Global Navigation (⌘1-9, ⌘0)
| Shortcut | Action |
|----------|--------|
| ⌘1 | Dashboard |
| ⌘2 | Approvals Inbox |
| ⌘3 | Comms Inbox |
| ⌘4 | Analytics |
| ⌘5 | Tasks (Kanban) |
| ⌘6 | Agents |
| ⌘7 | X / Twitter |
| ⌘8 | Voice Assistant |
| ⌘9 | Chat |
| ⌘0 | Connected Accounts |

### Global with Shift (⌘⇧)
| Shortcut | Action |
|----------|--------|
| ⌘⇧C | Context Control |
| ⌘⇧D | Code Agent Dashboard |
| ⌘⇧I | Inbox (3-pane) |
| ⌘⇧L | Library |
| ⌘⇧S | Starred Messages |
| ⌘⇧M | Quick Message |
| ⌘⇧N | Add Contact |
| ⌘⇧K | Add Skill |

### Global Actions
| Shortcut | Action |
|----------|--------|
| ⌘K | Global Search (primary) |
| ⌘F | Global Search |
| ⌘/ | Global Search (alt) |
| ⌘P | Command Palette |
| ⌘H | Help & Documentation |
| ⌘? | Keyboard Shortcuts Help |
| ⌘, | Settings |
| ⌘M | Toggle Mute |
| ⌘R | Refresh |

### Inbox Panel (Single-key)
| Shortcut | Action |
|----------|--------|
| J | Next item |
| K | Previous item |
| A | Approve |
| R | Reject |
| X | Defer |

---

## NEW Shortcuts (To Implement)

### TaskDetailPanel (⌘ shortcuts)
| Shortcut | Action | Implementation |
|----------|--------|----------------|
| ⌘S | Save changes | Update task metadata |
| ⌘E | Edit mode | Toggle editing |
| ⌘Enter | Complete task | Mark as done (if allowed) |
| ⌘⇧P | Poke agent | Trigger agent poke |
| ⌘⇧R | Reopen task | Show reopen modal |
| ⌘N | New subtask | Focus subtask input |
| ⌘1-4 | Switch tabs | Subtasks/Planning/Activity/Files |
| Esc | Close panel | onClose() |

### TaskDetailPanel (Tab shortcuts)
| Shortcut | Action |
|----------|--------|
| ⌘1 | Subtasks tab |
| ⌘2 | Planning tab |
| ⌘3 | Activity tab |
| ⌘4 | Files tab |
| ⌘5 | Review tab (if visible) |

### AgentDetailPanel (⌘ shortcuts)
| Shortcut | Action | Implementation |
|----------|--------|----------------|
| ⌘S | Save agent config | Update agent settings |
| ⌘R | Restart agent | Trigger agent restart |
| ⌘K | Kill agent | Abort agent session |
| ⌘N | New task for agent | Open task modal with pre-assigned |
| ⌘1-3 | Switch tabs | Activity/Config/Stats |
| Esc | Close panel | onClose() |

### SkillModal (⌘ shortcuts)
| Shortcut | Action | Implementation |
|----------|--------|----------------|
| ⌘S | Save skill | Submit skill form |
| ⌘Enter | Save & close | Submit and close |
| ⌘1-3 | Mode switch | Suggest/Dialogue/Manual |
| Esc | Close modal | Already implemented |

### Kanban Board (Single-key)
| Shortcut | Action |
|----------|--------|
| N | New task |
| F | Filter tasks |
| ? | Show help |

---

## Implementation Checklist

### Phase 1: Core Panel Shortcuts ✅
- [x] Document current shortcuts
- [ ] TaskDetailPanel keyboard handlers
- [ ] AgentDetailPanel keyboard handlers  
- [ ] SkillModal keyboard handlers
- [ ] Update KeyboardShortcuts.tsx reference

### Phase 2: UI Indicators
- [ ] Add tooltip hints to buttons (e.g., "Save (⌘S)")
- [ ] Show active shortcuts in panel headers
- [ ] Visual feedback on shortcut press

### Phase 3: Testing & Documentation
- [ ] Test all shortcuts
- [ ] Update help documentation
- [ ] Create shortcut cheat sheet

---

## Code Patterns

### Standard keyboard handler pattern:
```tsx
useEffect(() => {
  if (!isOpen) return;
  
  const handleKeyDown = (e: KeyboardEvent) => {
    // Escape to close
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    
    // Cmd+S to save
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
      return;
    }
    
    // Cmd+Enter to submit
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
      return;
    }
  };
  
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [isOpen, dependencies]);
```

### Tab switching pattern:
```tsx
const handleKeyDown = (e: KeyboardEvent) => {
  if (!(e.metaKey || e.ctrlKey)) return;
  
  const tabMap: Record<string, TabName> = {
    '1': 'subtasks',
    '2': 'planning',
    '3': 'activity',
    '4': 'files',
  };
  
  if (e.key in tabMap) {
    e.preventDefault();
    setActiveTab(tabMap[e.key]);
  }
};
```

---

## Future Enhancements

- **⌘⇧F** - Global fuzzy finder (tasks/agents/skills)
- **⌘B** - Toggle sidebar
- **⌘⇧/** - Show contextual shortcuts (panel-specific)
- **Arrow keys** - Navigate between tasks in Kanban
- **Space** - Quick preview/expand task

---

## Testing Plan

1. **Unit tests** - Each shortcut handler
2. **Integration tests** - Shortcut combinations
3. **Conflict detection** - No duplicate shortcuts
4. **Accessibility** - Screen reader compatibility
5. **Cross-platform** - Test on macOS/Linux/Windows (Ctrl vs Cmd)

---

## References

- **Implementation PR:** TBD
- **Related Issues:** TBD
- **Documentation:** `KeyboardShortcuts.tsx`, `HelpPanel.tsx`
