# Component Library Reference

Visual reference for all standardized components in the Froggo Dashboard.

---

## Buttons

### Primary Button
```jsx
<button className="px-4 py-2 bg-clawd-accent text-white rounded-lg hover:opacity-90 active:scale-95 transition-all">
  Primary Button
</button>
```

### Secondary Button
```jsx
<button className="px-4 py-2 bg-clawd-border text-clawd-text rounded-lg hover:bg-clawd-border/80 active:scale-95 transition-all">
  Secondary Button
</button>
```

### Ghost Button
```jsx
<button className="px-4 py-2 text-clawd-text rounded-lg hover:bg-clawd-surface active:scale-95 transition-all">
  Ghost Button
</button>
```

### Danger Button
```jsx
<button className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 active:scale-95 transition-all">
  Danger Button
</button>
```

### Icon Button
```jsx
<button className="icon-btn" aria-label="Settings">
  <Settings size={16} aria-hidden="true" />
</button>
```

### Button with Icon
```jsx
<button className="icon-text px-4 py-2 bg-clawd-accent text-white rounded-lg hover:opacity-90 transition-all">
  <Plus size={16} className="flex-shrink-0" />
  <span>Add Item</span>
</button>
```

### Button Sizes

#### Small
```jsx
<button className="px-3 py-1.5 text-sm bg-clawd-accent text-white rounded-lg">
  Small Button
</button>
```

#### Medium (Default)
```jsx
<button className="px-4 py-2 text-base bg-clawd-accent text-white rounded-lg">
  Medium Button
</button>
```

#### Large
```jsx
<button className="px-6 py-3 text-lg bg-clawd-accent text-white rounded-lg">
  Large Button
</button>
```

---

## Cards

### Basic Card
```jsx
<div className="p-4 bg-clawd-surface border border-clawd-border rounded-xl">
  <h3 className="text-lg font-semibold mb-2">Card Title</h3>
  <p className="text-sm text-clawd-text-dim">Card content goes here.</p>
</div>
```

### Card with Icon Header
```jsx
<div className="p-4 bg-clawd-surface border border-clawd-border rounded-xl">
  <div className="flex items-center gap-2 mb-3">
    <Icon size={18} className="text-clawd-accent flex-shrink-0" />
    <h3 className="text-lg font-semibold">Card Title</h3>
  </div>
  <p className="text-sm text-clawd-text-dim">Card description text</p>
</div>
```

### Interactive Card
```jsx
<div className="p-4 bg-clawd-surface border border-clawd-border rounded-xl shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all cursor-pointer">
  <h3 className="text-lg font-semibold mb-2">Clickable Card</h3>
  <p className="text-sm text-clawd-text-dim">This card has hover effects.</p>
</div>
```

### Card with Footer Actions
```jsx
<div className="p-4 bg-clawd-surface border border-clawd-border rounded-xl">
  <h3 className="text-lg font-semibold mb-2">Card Title</h3>
  <p className="text-sm text-clawd-text-dim mb-4">Card content.</p>
  <div className="flex gap-2">
    <button className="px-3 py-1.5 text-sm bg-clawd-accent text-white rounded-lg">
      Action
    </button>
    <button className="px-3 py-1.5 text-sm bg-clawd-border text-clawd-text rounded-lg">
      Cancel
    </button>
  </div>
</div>
```

### Card Sizes

#### Small
```jsx
<div className="p-3 bg-clawd-surface border border-clawd-border rounded-lg">
  <h3 className="text-base font-semibold mb-1">Small Card</h3>
  <p className="text-xs text-clawd-text-dim">Compact card content.</p>
</div>
```

#### Medium (Default)
```jsx
<div className="p-4 bg-clawd-surface border border-clawd-border rounded-xl">
  <h3 className="text-lg font-semibold mb-2">Medium Card</h3>
  <p className="text-sm text-clawd-text-dim">Standard card content.</p>
</div>
```

#### Large
```jsx
<div className="p-6 bg-clawd-surface border border-clawd-border rounded-2xl">
  <h3 className="text-xl font-semibold mb-3">Large Card</h3>
  <p className="text-base text-clawd-text-dim">Spacious card content.</p>
</div>
```

---

## Badges

### Status Badge (with dot)
```jsx
<span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-color-success-bg text-color-success">
  <span className="w-2 h-2 rounded-full bg-color-success" />
  Active
</span>
```

### Status Variants

#### Success
```jsx
<span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-color-success-bg text-color-success">
  <span className="w-2 h-2 rounded-full bg-color-success" />
  Success
</span>
```

#### Error
```jsx
<span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-color-error-bg text-color-error">
  <span className="w-2 h-2 rounded-full bg-color-error" />
  Error
</span>
```

#### Warning
```jsx
<span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-color-warning-bg text-color-warning">
  <span className="w-2 h-2 rounded-full bg-color-warning" />
  Warning
</span>
```

#### Info
```jsx
<span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-color-info-bg text-color-info">
  <span className="w-2 h-2 rounded-full bg-color-info" />
  Info
</span>
```

### Channel Badges

#### WhatsApp
```jsx
<span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-channel-whatsapp-bg text-channel-whatsapp border border-channel-whatsapp/30">
  WhatsApp
</span>
```

#### Discord
```jsx
<span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-channel-discord-bg text-channel-discord border border-channel-discord/30">
  Discord
</span>
```

#### Telegram
```jsx
<span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-channel-telegram-bg text-channel-telegram border border-channel-telegram/30">
  Telegram
</span>
```

### Priority Badges

#### P0 - Urgent
```jsx
<span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded bg-priority-p0-bg text-priority-p0">
  <AlertTriangle size={12} className="flex-shrink-0" />
  Urgent
</span>
```

#### P1 - High
```jsx
<span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded bg-priority-p1-bg text-priority-p1">
  <ArrowUp size={12} className="flex-shrink-0" />
  High
</span>
```

#### P2 - Medium
```jsx
<span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded bg-priority-p2-bg text-priority-p2">
  <Circle size={12} className="flex-shrink-0" />
  Medium
</span>
```

#### P3 - Low
```jsx
<span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded bg-priority-p3-bg text-priority-p3">
  <ArrowDown size={12} className="flex-shrink-0" />
  Low
</span>
```

---

## Inputs

### Text Input
```jsx
<input 
  type="text"
  placeholder="Enter text..."
  className="w-full px-4 py-2 bg-clawd-surface border border-clawd-border rounded-lg text-sm text-clawd-text placeholder:text-clawd-text-dim focus:outline-none focus:ring-2 focus:ring-clawd-accent focus:ring-offset-2 focus:ring-offset-clawd-bg"
/>
```

### Textarea
```jsx
<textarea 
  placeholder="Enter description..."
  rows={4}
  className="w-full px-4 py-2 bg-clawd-surface border border-clawd-border rounded-lg text-sm text-clawd-text placeholder:text-clawd-text-dim focus:outline-none focus:ring-2 focus:ring-clawd-accent focus:ring-offset-2 focus:ring-offset-clawd-bg resize-none"
/>
```

### Select Dropdown
```jsx
<select className="w-full px-4 py-2 bg-clawd-surface border border-clawd-border rounded-lg text-sm text-clawd-text focus:outline-none focus:ring-2 focus:ring-clawd-accent focus:ring-offset-2 focus:ring-offset-clawd-bg">
  <option>Option 1</option>
  <option>Option 2</option>
  <option>Option 3</option>
</select>
```

### Checkbox
```jsx
<label className="inline-flex items-center gap-2 cursor-pointer">
  <input 
    type="checkbox" 
    className="w-4 h-4 rounded border-clawd-border bg-clawd-surface text-clawd-accent focus:ring-2 focus:ring-clawd-accent focus:ring-offset-2 focus:ring-offset-clawd-bg"
  />
  <span className="text-sm text-clawd-text">Checkbox label</span>
</label>
```

### Radio Button
```jsx
<label className="inline-flex items-center gap-2 cursor-pointer">
  <input 
    type="radio" 
    name="radio-group"
    className="w-4 h-4 border-clawd-border bg-clawd-surface text-clawd-accent focus:ring-2 focus:ring-clawd-accent focus:ring-offset-2 focus:ring-offset-clawd-bg"
  />
  <span className="text-sm text-clawd-text">Radio option</span>
</label>
```

### Search Input
```jsx
<div className="relative">
  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-clawd-text-dim flex-shrink-0" />
  <input 
    type="search"
    placeholder="Search..."
    className="w-full pl-10 pr-4 py-2 bg-clawd-surface border border-clawd-border rounded-lg text-sm text-clawd-text placeholder:text-clawd-text-dim focus:outline-none focus:ring-2 focus:ring-clawd-accent"
  />
</div>
```

---

## Lists

### Simple List
```jsx
<div className="space-y-2">
  <div className="p-3 bg-clawd-surface border border-clawd-border rounded-lg hover:border-clawd-accent transition-all cursor-pointer">
    <div className="icon-text">
      <Icon size={16} className="flex-shrink-0" />
      <span className="text-sm">List item 1</span>
    </div>
  </div>
  <div className="p-3 bg-clawd-surface border border-clawd-border rounded-lg hover:border-clawd-accent transition-all cursor-pointer">
    <div className="icon-text">
      <Icon size={16} className="flex-shrink-0" />
      <span className="text-sm">List item 2</span>
    </div>
  </div>
</div>
```

### List with Meta Info
```jsx
<div className="space-y-2">
  <div className="p-3 bg-clawd-surface border border-clawd-border rounded-lg hover:border-clawd-accent transition-all cursor-pointer">
    <div className="flex items-center justify-between mb-1">
      <h4 className="text-sm font-medium">List Item Title</h4>
      <span className="text-xs text-clawd-text-dim">2h ago</span>
    </div>
    <p className="text-xs text-clawd-text-dim">Description text goes here</p>
  </div>
</div>
```

---

## Modals

### Standard Modal
```jsx
{/* Backdrop */}
<div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
  {/* Modal */}
  <div className="glass-modal rounded-2xl shadow-card-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
    {/* Header */}
    <div className="flex items-center justify-between p-6 border-b border-clawd-border">
      <h2 className="text-2xl font-semibold">Modal Title</h2>
      <button className="icon-btn" aria-label="Close">
        <X size={20} aria-hidden="true" />
      </button>
    </div>
    
    {/* Content */}
    <div className="p-6">
      <p className="text-sm text-clawd-text-dim">Modal content goes here...</p>
    </div>
    
    {/* Footer */}
    <div className="flex justify-end gap-2 p-6 border-t border-clawd-border">
      <button className="px-4 py-2 rounded-lg bg-clawd-border text-clawd-text hover:bg-clawd-border/80 transition-all">
        Cancel
      </button>
      <button className="px-4 py-2 rounded-lg bg-clawd-accent text-white hover:opacity-90 transition-all">
        Confirm
      </button>
    </div>
  </div>
</div>
```

---

## Loading States

### Spinner
```jsx
<Loader2 size={16} className="animate-spin text-clawd-accent" />
```

### Loading Button
```jsx
<button className="inline-flex items-center gap-2 px-4 py-2 bg-clawd-accent text-white rounded-lg" disabled>
  <Loader2 size={16} className="animate-spin flex-shrink-0" />
  <span>Loading...</span>
</button>
```

### Skeleton Card
```jsx
<div className="p-4 bg-clawd-surface border border-clawd-border rounded-xl animate-pulse">
  <div className="h-4 bg-clawd-border rounded w-3/4 mb-2"></div>
  <div className="h-3 bg-clawd-border rounded w-full mb-1"></div>
  <div className="h-3 bg-clawd-border rounded w-5/6"></div>
</div>
```

---

## Empty States

### Basic Empty State
```jsx
<div className="flex flex-col items-center justify-center p-12 text-center">
  <Icon size={48} className="text-clawd-text-dim mb-4" />
  <h3 className="text-lg font-semibold mb-2">No items found</h3>
  <p className="text-sm text-clawd-text-dim mb-4">Get started by creating your first item.</p>
  <button className="icon-text px-4 py-2 bg-clawd-accent text-white rounded-lg">
    <Plus size={16} className="flex-shrink-0" />
    <span>Create Item</span>
  </button>
</div>
```

---

## Tooltips

### Simple Tooltip
```jsx
<button 
  className="icon-btn" 
  aria-label="Settings"
  title="Settings"
>
  <Settings size={16} aria-hidden="true" />
</button>
```

---

## Alerts

### Success Alert
```jsx
<div className="flex items-start gap-3 p-4 bg-color-success-bg border border-color-success rounded-lg">
  <CheckCircle size={20} className="text-color-success flex-shrink-0 mt-0.5" />
  <div>
    <h4 className="text-sm font-medium text-color-success mb-1">Success</h4>
    <p className="text-xs text-clawd-text-dim">Your changes have been saved successfully.</p>
  </div>
</div>
```

### Error Alert
```jsx
<div className="flex items-start gap-3 p-4 bg-color-error-bg border border-color-error rounded-lg">
  <AlertCircle size={20} className="text-color-error flex-shrink-0 mt-0.5" />
  <div>
    <h4 className="text-sm font-medium text-color-error mb-1">Error</h4>
    <p className="text-xs text-clawd-text-dim">Something went wrong. Please try again.</p>
  </div>
</div>
```

### Warning Alert
```jsx
<div className="flex items-start gap-3 p-4 bg-color-warning-bg border border-color-warning rounded-lg">
  <AlertTriangle size={20} className="text-color-warning flex-shrink-0 mt-0.5" />
  <div>
    <h4 className="text-sm font-medium text-color-warning mb-1">Warning</h4>
    <p className="text-xs text-clawd-text-dim">This action cannot be undone.</p>
  </div>
</div>
```

---

## Icons

### Icon Sizes Reference
```jsx
<Icon size={12} />  {/* Extra small - badges, status */}
<Icon size={14} />  {/* Small - compact UI */}
<Icon size={16} />  {/* Medium (default) - buttons, cards */}
<Icon size={18} />  {/* Large - headings */}
<Icon size={20} />  {/* Extra large - modals, headers */}
<Icon size={24} />  {/* 2XL - large headers */}
<Icon size={32} />  {/* 3XL - hero sections */}
<Icon size={48} />  {/* 4XL - empty states */}
```

### Icon Badge (circular container)
```jsx
<div className="icon-badge bg-clawd-accent/20 text-clawd-accent">
  <Bot size={16} />
</div>
```

---

## Dividers

### Horizontal Divider
```jsx
<div className="border-t border-clawd-border my-4"></div>
```

### Vertical Divider
```jsx
<div className="border-l border-clawd-border h-full mx-4"></div>
```

---

## Layout Patterns

### Two Column Layout
```jsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <div className="p-4 bg-clawd-surface rounded-xl">Column 1</div>
  <div className="p-4 bg-clawd-surface rounded-xl">Column 2</div>
</div>
```

### Three Column Layout
```jsx
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
  <div className="p-4 bg-clawd-surface rounded-xl">Column 1</div>
  <div className="p-4 bg-clawd-surface rounded-xl">Column 2</div>
  <div className="p-4 bg-clawd-surface rounded-xl">Column 3</div>
</div>
```

### Card Grid
```jsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
  {items.map(item => (
    <div key={item.id} className="p-4 bg-clawd-surface rounded-xl">
      {item.name}
    </div>
  ))}
</div>
```

---

## Best Practices

1. **Always use CSS variables** for colors (no hardcoded hex)
2. **Use standard icon sizes** (12, 14, 16, 18, 20, 24, 32, 48)
3. **Add `flex-shrink-0` to all icons** in flex containers
4. **Use spacing scale** (gap-2, p-4, mb-2 - no gap-5, p-5)
5. **Include aria labels** on icon buttons
6. **Add focus styles** to all interactive elements
7. **Test light/dark themes** before committing
8. **Use semantic HTML** (button, nav, header, etc.)
9. **Include loading states** for async operations
10. **Verify contrast ratios** (4.5:1 minimum)

---

## Reference

See `DESIGN_SYSTEM.md` for complete documentation and `DESIGN_SYSTEM_QUICKSTART.md` for quick reference.
