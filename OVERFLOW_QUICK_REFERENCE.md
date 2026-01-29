# Text Truncation & Overflow - Quick Reference

## Common Patterns

### Task Title (Single-line Truncate)
```tsx
<div className="flex items-center gap-3 min-w-0">
  <Icon className="no-shrink" size={16} />
  <span className="task-title flex-fill">{task.title}</span>
  <Badge className="no-shrink" />
</div>
```

### Message Preview (2-line Truncate)
```tsx
<div className="message-preview">{message.content}</div>
```

### Agent/Session Name
```tsx
<span className="session-name flex-fill">{session.key}</span>
```

### Card Layout
```tsx
<div className="bg-clawd-surface rounded-xl border border-clawd-border overflow-hidden card-layout">
  <div className="card-header">
    <Icon className="no-shrink" />
    <span className="task-title flex-fill">Title</span>
    <Badge className="no-shrink" />
  </div>
  <div className="card-body">
    <div className="message-preview">Content...</div>
  </div>
  <div className="card-footer">
    <div className="flex-fill">Left</div>
    <div className="no-shrink">Right</div>
  </div>
</div>
```

## Utility Classes

### Text Truncation
- `.text-truncate` - Single-line with ellipsis
- `.text-truncate-2` - 2 lines with ellipsis
- `.text-truncate-3` - 3 lines with ellipsis
- `.task-title` - For task titles
- `.message-preview` - For message previews (2 lines)
- `.session-name` - For session/connection names
- `.agent-name` - For agent names

### Layout Control
- `.no-shrink` - Prevent element from shrinking (icons, badges)
- `.flex-fill` - Fill available space (text content)
- `.no-wrap` - Prevent text wrapping

### Spacing
- `.card-spacing` - Standard card padding (16px)
- `.card-gap` - Standard gap (12px)
- `.card-layout` - Complete card structure
- `.panel-layout` - Complete panel structure

## Rules

1. **Container** must have:
   - `min-w-0` (allows truncation)
   - `overflow-hidden` (clips overflow)

2. **Icons/Badges** must have:
   - `.no-shrink` (prevents compression)
   - `.no-wrap` (prevents text wrapping)

3. **Text content** must have:
   - Truncation class (`.text-truncate`, etc.)
   - `.flex-fill` or `flex-1` (fills space)

4. **Never use:**
   - `flex-wrap` on card footers/headers
   - Manual `.slice()` for UI truncation
   - Old Tailwind `truncate` class (use `.text-truncate` instead)

## Examples

### ✅ Good
```tsx
<div className="flex items-center gap-2 min-w-0 overflow-hidden">
  <CheckIcon className="no-shrink" />
  <span className="text-truncate flex-fill">{longText}</span>
  <span className="badge no-shrink">Status</span>
</div>
```

### ❌ Bad
```tsx
<div className="flex items-center gap-2">
  <CheckIcon />
  <span className="truncate">{longText.slice(0, 20)}...</span>
  <span className="badge">Status</span>
</div>
```

## Debugging

If text isn't truncating:
1. Check container has `min-w-0`
2. Check container has `overflow-hidden`
3. Check text element has truncation class
4. Check icons/badges have `.no-shrink`
5. Check no `flex-wrap` on parent

If layout is breaking:
1. Remove `flex-wrap`
2. Add `overflow-hidden` to card
3. Add `.no-shrink` to badges
4. Add `min-w-0` to flex containers
