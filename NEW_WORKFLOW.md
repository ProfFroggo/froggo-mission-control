# New Mandatory Workflow for Design System Implementation

**Task:** task-1769809773003  
**Established:** 2026-01-30  
**Authority:** Kevin (Critical Feedback)

---

## 🚨 THE WORKFLOW (NO EXCEPTIONS)

When redesigning ANY page or modal:

### Step 1: Design with Theme Awareness
- Use `dark:` prefix for dark-mode specific styles
- Use CSS variables (`var(--clawd-*)`) where possible
- NEVER hard-code colors like `text-white`, `text-blue-300` etc.
- Think: "Will this be readable in light mode AND dark mode?"

### Step 2: Take Dark Mode Screenshot
```bash
cd ~/clawd/clawd-dashboard
node screenshot-tool.js
```
- Review `~/clawd/screenshots/[component]-dark.png`
- Check: All text readable? Icons visible? Proper alignment?

### Step 3: Take Light Mode Screenshot
- Same tool automatically captures both modes
- Review `~/clawd/screenshots/[component]-light.png`
- Check: All text readable? No white-on-white? Icons visible?

### Step 4: Compare Side-by-Side
- Open both screenshots
- Look for:
  - Invisible text
  - Poor contrast
  - Misaligned elements
  - Missing borders
  - Broken layouts

### Step 5: Fix Issues
- If ANY problems found → fix them
- Re-run screenshot tool
- Repeat until BOTH modes look beautiful

### Step 6: Document
- Take final screenshots
- Add to redesign progress doc
- Note any special considerations

### Step 7: Mark Complete
- ONLY after visual verification in both modes
- Include screenshot links in completion message

---

## 🛠️ Screenshot Tool Usage

**Location:** `~/clawd/clawd-dashboard/screenshot-tool.js`

**What it does:**
1. Launches Playwright browser
2. Navigates to http://localhost:5173
3. Takes full-page screenshot in dark mode
4. Switches to light mode programmatically
5. Takes full-page screenshot in light mode
6. Saves to `~/clawd/screenshots/`

**Prerequisites:**
```bash
cd ~/clawd/clawd-dashboard
npx playwright install chromium  # One-time setup
npm run electron:dev             # App must be running
```

**Run it:**
```bash
node screenshot-tool.js
```

**Output:**
- `~/clawd/screenshots/dashboard-dark.png`
- `~/clawd/screenshots/dashboard-light.png`

---

## 🎨 Theme-Aware Color Patterns

### ❌ WRONG (Hard-Coded)
```tsx
className="text-blue-300"        // Invisible in light mode
className="text-white"            // Invisible in light mode
className="bg-gray-900"           // Too dark in light mode
className="border-white/10"       // Invisible in light mode
```

### ✅ RIGHT (Theme-Aware)
```tsx
className="text-blue-600 dark:text-blue-300"     // Readable in both
className="text-clawd-text"                      // CSS variable
className="bg-clawd-surface"                     // CSS variable
className="border-black/10 dark:border-white/10" // Visible in both
```

### CSS Variables (Preferred)
```css
var(--clawd-text)        /* Primary text */
var(--clawd-text-dim)    /* Secondary text */
var(--clawd-surface)     /* Card backgrounds */
var(--clawd-border)      /* Borders */
var(--clawd-accent)      /* Primary green */
```

---

## 📋 Checklist for Every Page/Modal

Before marking ANY component as complete:

- [ ] Designed with theme-aware colors from the start
- [ ] No hard-coded `text-white`, `text-[color]-300` etc.
- [ ] Tested in dark mode
- [ ] Screenshot taken (dark mode)
- [ ] Reviewed screenshot (dark mode)
- [ ] Tested in light mode
- [ ] Screenshot taken (light mode)
- [ ] Reviewed screenshot (light mode)
- [ ] Compared both screenshots side-by-side
- [ ] Fixed any visibility/contrast issues
- [ ] Re-screenshot after fixes
- [ ] Verified alignment, spacing, and layout
- [ ] All text readable in BOTH modes
- [ ] All icons visible in BOTH modes
- [ ] All borders visible in BOTH modes
- [ ] Documented any special cases
- [ ] Screenshots saved to `~/clawd/screenshots/`
- [ ] Progress doc updated with completion status

---

## 🔥 Kevin's Expectations

**When Kevin switches between light and dark mode:**
- It should look **beautiful in BOTH**
- No exceptions
- No excuses
- No "I forgot to test light mode"

**Visual verification is NOT optional:**
- Screenshots are mandatory
- Review them yourself before claiming completion
- If YOU wouldn't ship it, don't mark it complete

---

## 🚫 Anti-Patterns (Never Do These)

1. **"It works in dark mode, ship it!"** → NO. Test both modes.
2. **"I'll visually test it later"** → NO. Test NOW before marking complete.
3. **"Hard-coded colors are fine"** → NO. Use theme-aware alternatives.
4. **"I checked the code, it looks good"** → NO. Take screenshots.
5. **"Light mode will probably work"** → NO. Verify with your eyes.

---

## 💡 Pro Tips

1. **Start with dark mode first** (easier to see contrast issues)
2. **Then switch to light mode** and fix issues immediately
3. **Use the screenshot tool liberally** - it's fast and automatable
4. **Keep both screenshots open** for side-by-side comparison
5. **If in doubt, use CSS variables** over hard-coded colors
6. **Test early, test often** - don't wait until the end

---

## 📚 Resources

- **Style Guide:** `~/clawd/clawd-dashboard/STYLE_GUIDE.md`
- **Component Patterns:** `~/clawd/clawd-dashboard/src/component-patterns.css`
- **Design Tokens:** `~/clawd/clawd-dashboard/src/design-tokens.css`
- **Screenshot Tool:** `~/clawd/clawd-dashboard/screenshot-tool.js`
- **Example Fix:** `~/clawd/clawd-dashboard/DASHBOARD_FIXES_SUMMARY.md`

---

**Last Updated:** 2026-01-30  
**Enforcement:** MANDATORY for all design work
