# Hotkeys Testing Guide
Quick guide to test the new theme toggle and scroll navigation hotkeys.

## Prerequisites
```bash
cd ~/clawd/clawd-dashboard
npm run electron:dev
# OR
npm run electron:build && open release/mac-arm64/Froggo.app
```

## Test Cases

### 1. Theme Toggle (⌘⇧D)

#### Test 1.1: Basic Toggle
1. Open app (any panel)
2. Press **⌘⇧D**
3. **Expected:** Theme switches (dark ↔ light)
4. **Expected:** Toast notification appears: "Theme Changed - Switched to [Dark/Light] Mode"
5. Press **⌘⇧D** again
6. **Expected:** Theme switches back
7. **Expected:** Another toast notification

**Pass/Fail:** _______

#### Test 1.2: Theme Persistence
1. Press **⌘⇧D** to switch theme
2. Quit app completely
3. Reopen app
4. **Expected:** Theme from step 1 is retained

**Pass/Fail:** _______

#### Test 1.3: Works Everywhere
Test on each panel:
- [ ] Dashboard (⌘2)
- [ ] Inbox (⌘1)
- [ ] Tasks (⌘4)
- [ ] Settings (⌘,)
- [ ] Voice (⌘7)

**Expected:** ⌘⇧D works on all panels

**Pass/Fail:** _______

### 2. Scroll Navigation (⌥ + Arrows)

#### Test 2.1: Basic Scrolling
1. Navigate to Dashboard (⌘2) or Tasks (⌘4) - any panel with scrollable content
2. Press **⌥↓** (Option+Down) several times
3. **Expected:** Content scrolls down smoothly (~100px per press)
4. Press **⌥↑** (Option+Up) several times
5. **Expected:** Content scrolls up smoothly (~100px per press)

**Pass/Fail:** _______

#### Test 2.2: Page Scrolling
1. Navigate to a panel with long content (Tasks, Dashboard)
2. Press **⌥⇟** (Option+Page Down)
3. **Expected:** Content scrolls down by ~80% of viewport height
4. Press **⌥⇞** (Option+Page Up)
5. **Expected:** Content scrolls up by ~80% of viewport height

**Pass/Fail:** _______

#### Test 2.3: Smooth Scroll Animation
1. Press any scroll hotkey (⌥↑/↓/⇞/⇟)
2. **Expected:** Smooth animated scrolling (not instant jump)
3. **Expected:** Feels natural and not jarring

**Pass/Fail:** _______

#### Test 2.4: Works on Multiple Panels
Test on panels with scrollable content:
- [ ] Dashboard (⌘2)
- [ ] Tasks (⌘4) - task list and detail
- [ ] Inbox (⌘1) - message list
- [ ] Settings (⌘,) - settings list
- [ ] Chat (⌘8) - conversation history

**Expected:** Scroll hotkeys work on all panels

**Pass/Fail:** _______

### 3. Documentation

#### Test 3.1: Keyboard Shortcuts Modal
1. Press **⌘?** (Cmd+Shift+/)
2. **Expected:** Keyboard shortcuts modal opens
3. Find "Appearance & Navigation" category
4. **Expected:** Lists:
   - ⌘⇧D - Toggle Dark/Light Mode
   - ⌥↑ - Scroll Up
   - ⌥↓ - Scroll Down
   - ⌥⇞ - Scroll Page Up
   - ⌥⇟ - Scroll Page Down

**Pass/Fail:** _______

#### Test 3.2: Help Panel
1. Press **⌘H**
2. Search for "theme toggle"
3. **Expected:** Article "Theme Toggle & Scroll Navigation" appears
4. Click article
5. **Expected:** Full documentation with usage examples

**Pass/Fail:** _______

#### Test 3.3: Quick Tips
1. Navigate to Dashboard (⌘2)
2. Look for quick tips section (if visible)
3. **Expected:** May see tips:
   - 🌓 "Quick Theme Switch"
   - ⬆️ "Keyboard Scrolling"

**Pass/Fail:** _______

### 4. Edge Cases

#### Test 4.1: No Conflicts
1. Test that existing shortcuts still work:
   - [ ] ⌘K (Global Search)
   - [ ] ⌘1-9 (Navigation)
   - [ ] ⌘, (Settings)
2. **Expected:** No interference between hotkeys

**Pass/Fail:** _______

#### Test 4.2: Scroll at Boundaries
1. Scroll to top of content
2. Press **⌥↑** multiple times
3. **Expected:** Stays at top, no errors
4. Scroll to bottom
5. Press **⌥↓** multiple times
6. **Expected:** Stays at bottom, no errors

**Pass/Fail:** _______

#### Test 4.3: Theme Toggle During Modal
1. Open a modal (e.g., ⌘K command palette)
2. Press **⌘⇧D**
3. **Expected:** Theme toggles even with modal open
4. **Expected:** Modal theme updates correctly

**Pass/Fail:** _______

## Performance

### Test 5.1: Theme Toggle Speed
1. Rapidly press **⌘⇧D** 10 times
2. **Expected:** App responds quickly, no lag
3. **Expected:** Toast notifications appear for each toggle

**Pass/Fail:** _______

### Test 5.2: Scroll Performance
1. Hold down **⌥↓** (press repeatedly)
2. **Expected:** Smooth scrolling with no jank
3. **Expected:** No visual glitches

**Pass/Fail:** _______

## Bug Reports

If any test fails, document:
- Test number
- Steps to reproduce
- Expected behavior
- Actual behavior
- Screenshots/video if applicable

---

## Quick Reference

| Hotkey | Action |
|--------|--------|
| ⌘⇧D | Toggle Dark/Light Mode |
| ⌥↑ | Scroll Up |
| ⌥↓ | Scroll Down |
| ⌥⇞ | Scroll Page Up |
| ⌥⇟ | Scroll Page Down |

**Help:** Press ⌘? to see all shortcuts  
**Docs:** Press ⌘H → Search "theme toggle"
