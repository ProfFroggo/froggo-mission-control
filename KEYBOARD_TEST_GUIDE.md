# Keyboard Navigation Test Guide

## Quick Keyboard-Only Test (5 minutes)

Follow these steps to verify keyboard accessibility:

### 1. **Launch the Dashboard**
```bash
cd ~/clawd/clawd-dashboard
npm run electron:dev
# OR
open release/mac-arm64/Froggo.app
```

### 2. **Basic Navigation Test**

**Test the sidebar:**
1. Press `Tab` until sidebar is focused
2. Verify you see a **green focus ring** on the Dashboard button
3. Press `↓` arrow key - focus should move to next item
4. Press `↑` arrow key - focus should move to previous item
5. Press `Enter` - should navigate to that panel
6. **Expected:** Clear visual indicator, smooth navigation

**Test top bar:**
1. Continue pressing `Tab` to reach top bar
2. Focus mute button - should see green ring
3. Press `Space` or `Enter` - should toggle mute
4. Press `Tab` to call button
5. Press `Enter` - should open voice panel
6. **Expected:** All buttons reachable and activatable

### 3. **Command Palette Test**

1. Press `⌘K` (Cmd+K) anywhere in the app
2. Command palette should open with **focus in search box**
3. Type "dash" - should filter to dashboard commands
4. Press `↓` arrow - highlight should move down
5. Press `↑` arrow - highlight should move up
6. Press `Enter` - should execute command
7. Press `Escape` - should close palette
8. **Expected:** Instant open, keyboard filterable, smooth navigation

### 4. **Modal Focus Trap Test**

1. Open any modal (e.g., create task)
2. Press `Tab` repeatedly
3. **Verify:** Focus stays within modal (doesn't escape to background)
4. **Verify:** Tab cycles through modal elements
5. **Verify:** Shift+Tab cycles backwards
6. Press `Escape` - modal closes
7. **Verify:** Focus returns to trigger element
8. **Expected:** Focus trapped, no background interaction

### 5. **Skip Navigation Test**

1. Reload the app
2. Press `Tab` once from fresh load
3. **Expected:** "Skip to main content" link appears
4. Press `Enter` - should jump to main content area
5. Press `Tab` - next focus should be in main content, not sidebar
6. **Expected:** Quick access to main content

### 6. **Panel Switching Test**

Test all keyboard shortcuts:
- `⌘1` - Dashboard
- `⌘2` - Inbox
- `⌘3` - Comms
- `⌘4` - Analytics
- `⌘5` - Tasks
- `⌘6` - Agents
- `⌘7` - X/Twitter
- `⌘8` - Voice
- `⌘9` - Chat

**Expected:** Each shortcut instantly switches panel

### 7. **Form Navigation Test**

1. Navigate to a form (e.g., Settings)
2. Press `Tab` through all form fields
3. **Verify:** Each field shows focus ring
4. **Verify:** Can type/select without mouse
5. **Verify:** Required fields marked visually
6. **Expected:** Complete form fillable via keyboard

---

## Screen Reader Test (VoiceOver - 10 minutes)

### Enable VoiceOver
```
Cmd+F5  (or System Preferences > Accessibility > VoiceOver)
```

### Basic Commands
- `Ctrl+Option+→` - Next item
- `Ctrl+Option+←` - Previous item
- `Ctrl+Option+Space` - Activate
- `Ctrl+Option+U` - Web rotor (landmarks)

### Test Checklist

**1. Landmarks Navigation**
- Press `Ctrl+Option+U`, select "Landmarks"
- **Should hear:** "banner", "navigation", "main"
- Navigate between landmarks
- **Expected:** Quick jump to major sections

**2. Button Labels**
- Navigate to sidebar
- Focus each navigation button
- **Should hear:** "Dashboard button", "Approvals, 5 items, button", etc.
- **Expected:** Meaningful, descriptive labels

**3. Current Page Indicator**
- Navigate to sidebar
- Focus currently active panel button
- **Should hear:** "current page" in announcement
- **Expected:** Clear indication of current location

**4. Status Updates**
- Focus connection status
- **Should hear:** "Connected to server" or "Connecting to server"
- Toggle mute button
- **Should hear:** "Mute microphone, pressed" or "unpressed"
- **Expected:** States clearly announced

**5. Live Regions**
- Open command palette (`⌘K`)
- **Should hear:** "Command palette opened"
- Type in search
- **Should hear:** "5 commands found" (or similar)
- **Expected:** Changes announced automatically

**6. Form Labels**
- Navigate to a form
- Focus each input
- **Should hear:** Label before input
- Required fields should mention "required"
- **Expected:** All inputs properly labeled

---

## High Contrast Mode Test (2 minutes)

### Enable High Contrast (macOS)
```
System Preferences > Accessibility > Display > Increase Contrast
```

### Visual Checks
- [ ] All text is readable
- [ ] Borders are clearly visible (2px thickness)
- [ ] Focus indicators stand out
- [ ] Buttons/links distinguishable
- [ ] Icons/graphics have sufficient contrast
- [ ] No information conveyed by color alone

**Expected:** Everything remains usable with enhanced contrast

---

## Reduced Motion Test (2 minutes)

### Enable Reduced Motion (macOS)
```
System Preferences > Accessibility > Display > Reduce Motion
```

### Visual Checks
- [ ] No spinning loading indicators
- [ ] No pulsing animations
- [ ] Transitions are instant
- [ ] Modal open/close is immediate
- [ ] Panel switching has no animation
- [ ] Sidebar collapse is instant

**Expected:** Zero motion/animation throughout app

---

## Test Results Template

```markdown
## Accessibility Test Results

**Date:** YYYY-MM-DD
**Tester:** [Your name]
**Environment:** macOS / Windows / Linux

### Keyboard Navigation
- [ ] Pass - All interactive elements reachable
- [ ] Pass - Visible focus indicators
- [ ] Pass - Logical tab order
- [ ] Pass - Skip navigation works
- [ ] Pass - Modal focus trap works
- [ ] Pass - Keyboard shortcuts work

### Screen Reader (VoiceOver/NVDA/JAWS)
- [ ] Pass - Landmarks announced
- [ ] Pass - Button labels descriptive
- [ ] Pass - Current page indicated
- [ ] Pass - Status updates announced
- [ ] Pass - Forms properly labeled
- [ ] Pass - Live regions work

### High Contrast Mode
- [ ] Pass - All text readable
- [ ] Pass - Borders visible
- [ ] Pass - Focus visible
- [ ] Pass - No color-only information

### Reduced Motion
- [ ] Pass - Animations disabled
- [ ] Pass - Transitions instant
- [ ] Pass - No motion artifacts

### Overall Result
- [ ] **PASS** - Ready for production
- [ ] **FAIL** - Issues found (see notes)

### Notes
[Add any observations or issues here]
```

---

## Common Issues & How to Fix

### Issue: Can't see focus indicator
**Fix:** Check if `:focus-visible` is supported in browser. Try adding `:focus` fallback.

### Issue: Tab order seems random
**Fix:** Check HTML structure. Ensure logical DOM order, not relying on CSS for positioning.

### Issue: Can't escape modal
**Fix:** Verify focus trap implementation. Ensure Escape key handler exists.

### Issue: Screen reader not announcing changes
**Fix:** Check ARIA live regions. Ensure `aria-live="polite"` is set.

### Issue: Skip link doesn't appear
**Fix:** Check CSS. Skip link should be positioned absolutely and revealed on :focus.

---

## Quick Pass/Fail Criteria

**PASS if:**
- ✅ Can navigate entire app with keyboard only
- ✅ All actions performable without mouse
- ✅ Focus always visible
- ✅ Screen reader announces all important info
- ✅ High contrast mode works
- ✅ Reduced motion respected

**FAIL if:**
- ❌ Any element unreachable by keyboard
- ❌ Focus gets stuck/lost
- ❌ Important info not announced
- ❌ Color is only indicator of state
- ❌ Animations play despite reduced motion preference

---

## Contact

Issues found? Report them with:
- Browser/OS version
- Assistive technology used
- Steps to reproduce
- Expected vs. actual behavior

---

**Happy Testing! 🧪**
