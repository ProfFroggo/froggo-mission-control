# Badge Fixes - Visual Guide

## Before vs After Examples

### ❌ BEFORE (Problematic Badges)

#### Example 1: Badge Text Wrapping
```tsx
<span className="px-2 py-1 rounded bg-blue-500/20 text-blue-400">
  Long Badge Text That Wraps
</span>
```
**Problem:** Text wraps to multiple lines, breaking layout

#### Example 2: Badge Shrinking
```tsx
<div className="flex items-center gap-2">
  <span className="flex-1 truncate">Long title text...</span>
  <span className="px-2 py-1 rounded bg-red-500/20 text-red-400">
    Important
  </span>
</div>
```
**Problem:** Badge shrinks or disappears on narrow screens

#### Example 3: Badge Overlap
```tsx
<div className="flex items-center gap-1">
  <Mail size={12} />
  <span className="px-1.5 py-0.5 rounded bg-blue-500/20">
    99
  </span>
</div>
```
**Problem:** Icon and count overlap when space is tight

---

### ✅ AFTER (Fixed Badges)

#### Example 1: No Text Wrapping
```tsx
<span className="px-2 py-1 rounded bg-blue-500/20 text-blue-400 flex-shrink-0 whitespace-nowrap">
  Long Badge Text That Wraps
</span>
```
**Solution:** `whitespace-nowrap` prevents wrapping, container wraps instead

#### Example 2: No Badge Shrinking
```tsx
<div className="flex items-center gap-2 min-w-0">
  <span className="flex-1 min-w-0 truncate">Long title text...</span>
  <span className="px-2 py-1 rounded bg-red-500/20 text-red-400 flex-shrink-0 whitespace-nowrap">
    Important
  </span>
</div>
```
**Solution:** `flex-shrink-0` protects badge, title truncates instead

#### Example 3: No Badge Overlap
```tsx
<div className="flex items-center gap-1">
  <Mail size={12} className="flex-shrink-0" />
  <span className="px-1.5 py-0.5 rounded bg-blue-500/20 flex-shrink-0 whitespace-nowrap">
    99
  </span>
</div>
```
**Solution:** Both icon and badge protected with `flex-shrink-0`

---

## Component-Specific Fixes

### NotificationsPanelV2 - Priority Badges

**Before:**
```tsx
<span className={`px-1.5 py-0.5 text-xs rounded ${priorityBadge.color}`}>
  {priorityBadge.label}
</span>
```

**After:**
```tsx
<span className={`px-1.5 py-0.5 text-xs rounded flex-shrink-0 whitespace-nowrap ${priorityBadge.color}`}>
  {priorityBadge.label}
</span>
```

**Visual Result:**
```
Before: [High Priority] wraps to [High      ]
                                [Priority   ]

After:  [High Priority] stays inline, container wraps if needed
```

---

### CalendarPanel - Event Badges

**Before:**
```tsx
<span className={`text-xs px-1.5 py-0.5 rounded ${color}`}>
  {event.priority}
</span>
```

**After:**
```tsx
<span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 whitespace-nowrap ${color}`}>
  {event.priority}
</span>
```

**Visual Result:**
```
Before: Event title cuts off badge → "Important Me... [Hi]"

After:  Badge stays full size → "Important... [High]"
```

---

### TopBar - Status Indicators

**Already Fixed (Verified):**
```tsx
<div className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex-shrink-0 whitespace-nowrap ${color}`}>
  <Icon size={14} className="flex-shrink-0" />
  <span className="flex-shrink-0">Status Text</span>
</div>
```

**Visual Result:**
```
All TopBar indicators maintain full size and alignment:
[🌐 Online] [⚡ Watcher •] [🔒 Blocked] [📥 5 pending] [⚙️ 3 running]

Never wraps to:
[🌐 Onli...]
[ne]
```

---

### EmailWidget - Count Badges

**Before:**
```tsx
<span className="text-xs px-1.5 py-0.5 bg-clawd-accent/20 text-clawd-accent rounded-full">
  {totalUnread} unread
</span>
```

**After:**
```tsx
<span className="text-xs px-1.5 py-0.5 bg-clawd-accent/20 text-clawd-accent rounded-full flex-shrink-0 whitespace-nowrap">
  {totalUnread} unread
</span>
```

**Visual Result:**
```
Before: [42 unread] might become [42     ]
                                  [unread ]

After:  [42 unread] always stays as one unit
```

---

## Layout Pattern Reference

### Proper Badge Container

```tsx
<div className="flex items-center gap-2 min-w-0">
  {/* Flexible content (can truncate) */}
  <span className="flex-1 min-w-0 text-truncate">
    This text can be truncated with ellipsis...
  </span>
  
  {/* Fixed badges (never shrink) */}
  <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-400 flex-shrink-0 whitespace-nowrap">
    Badge 1
  </span>
  
  <span className="px-2 py-1 rounded bg-green-500/20 text-green-400 flex-shrink-0 whitespace-nowrap">
    Badge 2
  </span>
</div>
```

### Visual Behavior

**Narrow container (300px):**
```
[This text can be tru...] [Badge 1] [Badge 2]
```

**Very narrow container (200px):**
```
[This text...]
[Badge 1] [Badge 2]
```
(Container wraps, but badges stay intact)

**Wide container (600px):**
```
[This text can be truncated with ellipsis...] [Badge 1] [Badge 2]
```

---

## Testing Scenarios

### ✅ Scenario 1: Narrow Window
- Resize window to 768px width
- All badges remain visible and readable
- Badge text doesn't wrap internally
- Container may wrap badges to new line if needed

### ✅ Scenario 2: Long Badge Text
- Badge text: "Very Long Badge Label Text"
- Badge stays on one line
- Container wraps or scrolls if needed
- No internal text wrapping

### ✅ Scenario 3: Multiple Badges
- 5+ badges in one container
- All badges maintain full size
- Badges wrap to next line together (not individually)
- No badge overlap

### ✅ Scenario 4: Badge + Icon
- Icon next to badge
- Both have flex-shrink-0
- Both stay visible at all widths
- Proper spacing maintained

---

## CSS Classes Reference

| Class | Purpose | Usage |
|-------|---------|-------|
| `flex-shrink-0` | Prevent element from shrinking | Always use on badges |
| `whitespace-nowrap` | Prevent text wrapping | Always use on badge text |
| `text-truncate` | Single-line ellipsis | Use on flexible text content |
| `min-w-0` | Allow flex item to shrink below content size | Use on containers that should truncate |
| `flex-1` | Grow to fill space | Use on text that should expand |

---

## Quick Reference Checklist

When creating or fixing a badge:

- [ ] Add `flex-shrink-0` class
- [ ] Add `whitespace-nowrap` class  
- [ ] Icon next to badge also has `flex-shrink-0`
- [ ] Container has `min-w-0` if it contains truncatable text
- [ ] Truncatable text has `text-truncate` or `truncate`
- [ ] Test at narrow widths (< 768px)
- [ ] Test with long badge text
- [ ] Verify no overlap with adjacent elements

---

**Last Updated:** 2026-01-29  
**Task:** task-1769687265173  
**Agent:** coder
