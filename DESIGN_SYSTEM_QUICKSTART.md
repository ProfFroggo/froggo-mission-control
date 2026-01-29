# Design System Quick Start

Fast reference for building components with Froggo Dashboard design standards.

---

## 🎨 Colors

```jsx
/* Theme colors (light/dark adaptive) */
bg-clawd-bg          // Main background
bg-clawd-surface     // Cards, panels
border-clawd-border  // Borders
text-clawd-text      // Primary text
text-clawd-text-dim  // Secondary text
bg-clawd-accent      // Primary accent (green)

/* Status colors */
text-color-success   // Success text
bg-color-success-bg  // Success background
text-color-error     // Error text
bg-color-error-bg    // Error background
text-color-warning   // Warning text
text-color-info      // Info text
```

---

## 📐 Spacing

**Most common values:**

| Class | Size | Usage |
|-------|------|-------|
| `gap-2` | 8px | **Default spacing** (icon+text, list items) |
| `p-2` | 8px | Small buttons, badges |
| `p-4` | 16px | Cards, panels, modals |
| `mb-2` | 8px | Default bottom margin |
| `mb-4` | 16px | Section spacing |

**Quick pattern:**
```jsx
<div className="p-4 mb-4 gap-2">
  {/* Card with standard spacing */}
</div>
```

---

## 🔤 Typography

```jsx
text-xs    // 12px - Labels, badges, timestamps
text-sm    // 14px - Body text (DEFAULT)
text-base  // 16px - Emphasized text
text-lg    // 18px - Subheadings
text-xl    // 20px - Section headings
text-2xl   // 24px - Page headings
```

**Font weights:**
```jsx
font-normal    // 400 - Body text
font-medium    // 500 - Emphasized text, buttons
font-semibold  // 600 - Headings
```

---

## 🎯 Icons

**Standard sizes:**

| Size | Usage |
|------|-------|
| `12` | Priority badges, status dots |
| `14` | Small buttons, compact UI |
| `16` | **Default** - buttons, cards, lists |
| `18` | Headings, emphasis |
| `20` | Section headers, modals |
| `24` | Large headers, important actions |

**Always add `flex-shrink-0`:**
```jsx
<Icon size={16} className="flex-shrink-0" />
```

**Icon + text pattern:**
```jsx
<div className="icon-text">
  <Icon size={16} className="flex-shrink-0" />
  <span>Text</span>
</div>
```

---

## 🔘 Buttons

```jsx
{/* Primary */}
<button className="px-4 py-2 bg-clawd-accent text-white rounded-lg hover:opacity-90 active:scale-95 transition-all">
  Primary
</button>

{/* Secondary */}
<button className="px-4 py-2 bg-clawd-border text-clawd-text rounded-lg hover:bg-clawd-border/80 active:scale-95 transition-all">
  Secondary
</button>

{/* Icon button */}
<button className="icon-btn">
  <Icon size={16} />
</button>
```

**Sizes:**
- Small: `px-3 py-1.5 text-sm`
- Medium: `px-4 py-2 text-base` (default)
- Large: `px-6 py-3 text-lg`

---

## 🏷️ Badges

```jsx
{/* Status badge */}
<span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-color-success-bg text-color-success">
  <span className="w-2 h-2 rounded-full bg-color-success" />
  Active
</span>

{/* Channel badge */}
<span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-channel-whatsapp-bg text-channel-whatsapp border border-channel-whatsapp/30">
  WhatsApp
</span>
```

---

## 📦 Cards

```jsx
<div className="p-4 bg-clawd-surface border border-clawd-border rounded-xl shadow-card hover:shadow-card-hover transition-all">
  <div className="flex items-center gap-2 mb-3">
    <Icon size={18} className="text-clawd-accent flex-shrink-0" />
    <h3 className="text-lg font-semibold">Card Title</h3>
  </div>
  <p className="text-sm text-clawd-text-dim mb-2">
    Description
  </p>
</div>
```

**Sizes:**
- Small: `p-3 rounded-lg`
- Medium: `p-4 rounded-xl` (default)
- Large: `p-6 rounded-2xl`

---

## 🔄 Animations

```jsx
/* Standard transitions */
transition-all duration-150  // Fast (buttons, hovers)
transition-all duration-200  // Normal (dropdowns)
transition-all duration-300  // Smooth (panels, modals)

/* Button press */
active:scale-95

/* Loading */
animate-pulse
animate-spin
```

---

## 📐 Border Radius

```jsx
rounded-lg    // 8px - Default (buttons, inputs, small cards)
rounded-xl    // 12px - Large cards, panels
rounded-2xl   // 16px - Modals, hero cards
rounded-full  // Pill - Badges, avatars
```

---

## ♿ Accessibility

```jsx
{/* Icon buttons - always label */}
<button aria-label="Close">
  <X size={20} aria-hidden="true" />
</button>

{/* Focus styles */}
<button className="focus:outline-none focus:ring-2 focus:ring-clawd-accent focus:ring-offset-2">
  Accessible button
</button>
```

---

## ⚡ Quick Component Templates

### Button with Icon
```jsx
<button className="icon-text px-4 py-2 bg-clawd-accent text-white rounded-lg hover:opacity-90 transition-all">
  <Plus size={16} className="flex-shrink-0" />
  <span>Add Item</span>
</button>
```

### Card with Header
```jsx
<div className="p-4 bg-clawd-surface border border-clawd-border rounded-xl">
  <div className="flex items-center gap-2 mb-3">
    <Icon size={18} className="flex-shrink-0" />
    <h3 className="text-lg font-semibold">Title</h3>
  </div>
  <p className="text-sm text-clawd-text-dim">Content</p>
</div>
```

### Status Badge
```jsx
<span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full bg-color-success-bg text-color-success">
  <span className="w-2 h-2 rounded-full bg-color-success" />
  Online
</span>
```

### Icon Button
```jsx
<button className="icon-btn" aria-label="Settings">
  <Settings size={16} aria-hidden="true" />
</button>
```

---

## 🚫 Common Mistakes

❌ **DON'T:**
- Hardcode colors: `bg-gray-900`
- Use non-standard icon sizes: `size={15}`
- Forget `flex-shrink-0` on icons
- Skip aria labels on icon buttons
- Use inconsistent spacing: `p-5`, `gap-5`

✅ **DO:**
- Use CSS variables: `bg-clawd-surface`
- Standard icon sizes: `size={16}`
- Always `flex-shrink-0` on icons
- Label all interactive elements
- Use spacing scale: `p-4`, `gap-2`

---

## 📚 Full Documentation

See `DESIGN_SYSTEM.md` for complete design system documentation.

---

## ⚡ VS Code Snippets

Add to `.vscode/snippets.code-snippets`:

```json
{
  "Card Component": {
    "prefix": "froggo-card",
    "body": [
      "<div className=\"p-4 bg-clawd-surface border border-clawd-border rounded-xl\">",
      "  <div className=\"flex items-center gap-2 mb-3\">",
      "    <${1:Icon} size={18} className=\"flex-shrink-0\" />",
      "    <h3 className=\"text-lg font-semibold\">${2:Title}</h3>",
      "  </div>",
      "  <p className=\"text-sm text-clawd-text-dim\">${3:Content}</p>",
      "</div>"
    ]
  },
  "Button Component": {
    "prefix": "froggo-button",
    "body": [
      "<button className=\"px-4 py-2 bg-clawd-accent text-white rounded-lg hover:opacity-90 active:scale-95 transition-all\">",
      "  ${1:Button Text}",
      "</button>"
    ]
  },
  "Icon Text": {
    "prefix": "froggo-icon-text",
    "body": [
      "<div className=\"icon-text\">",
      "  <${1:Icon} size={16} className=\"flex-shrink-0\" />",
      "  <span>${2:Text}</span>",
      "</div>"
    ]
  }
}
```
