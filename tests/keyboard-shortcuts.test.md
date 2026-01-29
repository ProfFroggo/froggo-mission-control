# Keyboard Shortcuts Testing Checklist

**Date:** 2026-01-29  
**Tester:** ___________  
**Build:** ___________

---

## Global Navigation (⌘1-9, ⌘0)

Test in main app window:

- [ ] ⌘1 → Dashboard panel opens
- [ ] ⌘2 → Approvals Inbox opens
- [ ] ⌘3 → Comms Inbox opens
- [ ] ⌘4 → Analytics opens
- [ ] ⌘5 → Tasks (Kanban) opens
- [ ] ⌘6 → Agents opens
- [ ] ⌘7 → X/Twitter opens
- [ ] ⌘8 → Voice Assistant opens
- [ ] ⌘9 → Chat opens
- [ ] ⌘0 → Connected Accounts opens

**Secondary Panels:**
- [ ] ⌘⇧C → Context Control Board
- [ ] ⌘⇧D → Code Agent Dashboard
- [ ] ⌘⇧L → Library
- [ ] ⌘⇧S → Schedule

---

## Global Actions

Test from any panel:

- [ ] ⌘K → Command Palette opens
- [ ] ⌘/ → Global Search opens
- [ ] ⌘? (⌘⇧/) → Keyboard Shortcuts help opens
- [ ] ⌘, → Settings panel opens
- [ ] ⌘M → Toggle mute (check voice panel)
- [ ] Esc → Closes open modals/panels

**Quick Actions:**
- [ ] ⌘⇧M → Quick Message modal opens
- [ ] ⌘⇧N → Add Contact modal opens
- [ ] ⌘⇧K → Add Skill modal opens

---

## Kanban Panel (⌘5)

Navigate to Tasks panel (⌘5), then test:

**Basic Actions:**
- [ ] N (lowercase, no modifiers) → New Task modal opens
- [ ] ⌘N → New Task modal opens
- [ ] ⌘R → Tasks refresh (toast shows "Tasks refreshed")
- [ ] ⌘F → Filter panel toggles
- [ ] ⌘F again → Filter panel closes
- [ ] ? → Keyboard help shows
- [ ] Esc → Closes help/filters

**With Task Selected:**
1. Click any task to select it
2. Test:
   - [ ] ⌘E → Edit mode (info toast)
   - [ ] ⌘⌫ → Delete confirmation appears
   - [ ] Esc → Deselects task

**Input Safety:**
1. Open filter panel (⌘F)
2. Click in search input
3. Type "n" → Should type "n", NOT open new task modal
4. [ ] ✅ Shortcuts don't trigger in inputs

---

## Task Modal

Open new task modal (⌘5 → N), then test:

**Manual Mode:**
- [ ] Type task title
- [ ] ⌘S → Task created and modal closes
- [ ] Esc → Modal closes without saving

**Chat Mode:**
1. Open modal, select Chat mode
2. Type message and send
3. After conversation complete:
   - [ ] ⌘Enter → Creates task from chat
   - [ ] Esc → Cancels and closes

**UI Hints:**
- [ ] "Create Task" button shows `⌘S` badge

---

## X/Twitter Panel (⌘7)

Navigate to X panel (⌘7), then test:

**Tab Navigation:**
- [ ] ⌘1 → Research tab
- [ ] ⌘2 → Plan tab
- [ ] ⌘3 → Drafts tab
- [ ] ⌘4 → Mentions tab
- [ ] ⌘5 → Timeline tab
- [ ] ⌘6 → Analytics tab

**Actions:**
- [ ] ⌘N → Switches to Plan tab (compose area)
- [ ] ⌘R in Mentions → Refreshes mentions
- [ ] ⌘R in Timeline → Refreshes timeline
- [ ] ⌘R in Analytics → Refreshes both

**Input Safety:**
1. Go to Plan tab
2. Click in compose textarea
3. Type "n" → Should type "n", NOT switch tabs
4. [ ] ✅ Shortcuts don't trigger in compose area

---

## Inbox Panel (⌘2)

Navigate to Approvals Inbox (⌘2), ensure items exist, then test:

**Navigation:**
- [ ] J → Moves to next item
- [ ] K → Moves to previous item
- [ ] ⌘↑ → (if implemented) Jump to first
- [ ] ⌘↓ → (if implemented) Jump to last

**Actions:**
- [ ] A → Approves focused item
- [ ] R → Rejects focused item
- [ ] X → Defers focused item

**Input Safety:**
1. If search/filter exists, click in input
2. Type "j" → Should type "j", NOT navigate
3. [ ] ✅ Shortcuts don't trigger in inputs

---

## Chat Panel (⌘9)

Navigate to Chat (⌘9), then test:

**In Chat Input:**
- [ ] Type message
- [ ] Enter → Sends message
- [ ] ⌘Enter → Sends message
- [ ] ⇧Enter → Creates new line (doesn't send)

---

## Voice Panel (⌘8)

Navigate to Voice (⌘8), then test:

- [ ] ⌘M → Toggles mute status
- [ ] Check if orb or UI reflects mute state

---

## Keyboard Shortcuts Help Panel

Open help panel (⌘?), then verify:

**Content:**
- [ ] All shortcuts listed and categorized
- [ ] Symbols display correctly (⌘, ⇧, ⌥)
- [ ] Sections: Navigation, Actions, Tasks, Inbox, X, Chat, etc.

**Interaction:**
- [ ] Esc → Closes help panel
- [ ] Click X button → Closes help panel
- [ ] Click outside → (optional) Closes help panel

---

## Tooltips

Test tooltip component:

1. Hover over "New Task" button in Kanban
2. [ ] Tooltip appears after ~500ms
3. [ ] Shows descriptive text
4. [ ] Shows keyboard shortcut hint (if implemented)
5. [ ] Mouse away → Tooltip disappears

---

## Edge Cases & Safety

**Modifier Key Conflicts:**
- [ ] ⌘D doesn't conflict (shouldn't trigger browser bookmark)
- [ ] ⌘F doesn't trigger browser find (should open app filters)
- [ ] ⌘R doesn't refresh page (should refresh app data)

**Input Field Safety:**
- [ ] Typing in Task title input doesn't trigger shortcuts
- [ ] Typing in Task description textarea doesn't trigger shortcuts
- [ ] Typing in search boxes doesn't trigger shortcuts
- [ ] Typing in X compose area doesn't trigger shortcuts
- [ ] Typing in Chat doesn't trigger shortcuts

**Modal Stacking:**
1. Open Command Palette (⌘K)
2. Open a second modal (e.g., Settings ⌘,)
3. [ ] Esc closes top modal first
4. [ ] Esc again closes remaining modal

**Rapid Key Presses:**
1. Quickly press ⌘1 → ⌘5 → ⌘7
2. [ ] All panels load correctly
3. [ ] No crashes or UI glitches

---

## Accessibility

**Keyboard-Only Navigation:**
1. Unplug mouse (or don't use it)
2. [ ] Can navigate all panels with ⌘1-9
3. [ ] Can open modals with shortcuts
4. [ ] Can close modals with Esc
5. [ ] Can submit forms with ⌘S or Enter
6. [ ] Tab key cycles through form fields
7. [ ] No keyboard traps (always can escape)

**Screen Reader:**
(If available)
- [ ] Shortcut actions announce results
- [ ] Focus moves logically
- [ ] Button labels include shortcut hints

---

## Performance

**Shortcut Response Time:**
- [ ] ⌘1-9 panel switches feel instant (<100ms)
- [ ] ⌘K opens palette immediately
- [ ] No lag when pressing shortcuts
- [ ] No visual jank during panel transitions

---

## Cross-Platform (if applicable)

**macOS:**
- [ ] All ⌘ shortcuts work
- [ ] Standard macOS behavior respected

**Windows/Linux:**
- [ ] Ctrl key works instead of ⌘
- [ ] All shortcuts map correctly
- [ ] No OS conflicts (e.g., Alt+F4)

---

## Bugs Found

List any issues discovered:

1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

---

## Test Summary

**Total Tests:** ___ / ___  
**Passed:** ___  
**Failed:** ___  
**Blocked:** ___

**Overall Status:** ⬜ Pass | ⬜ Fail | ⬜ Needs Work

**Notes:**
_______________________________________________
_______________________________________________
_______________________________________________

**Tester Signature:** _______________  
**Date:** _______________
