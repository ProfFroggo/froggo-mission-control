# Design System Implementation Checklist

Track progress on implementing the design system standards across the Froggo Dashboard.

---

## Phase 1: Foundation (Week 1)

### Setup
- [x] ✅ Create design system documentation
- [x] ✅ Create CSS variables file (design-tokens.css)
- [x] ✅ Create quick reference guide
- [x] ✅ Create component library reference
- [ ] Import design-tokens.css in index.css
- [ ] Test CSS variables in components
- [ ] Share documentation with team

### Immediate Wins
- [ ] Replace hardcoded colors in new components
- [ ] Use standard icon sizes in new components
- [ ] Apply spacing scale in new components
- [ ] Add aria labels to icon buttons
- [ ] Test light/dark theme switching

---

## Phase 2: Component Migration (Weeks 2-3)

### High Priority Components
- [ ] **Buttons** - Standardize sizes and spacing
- [ ] **Cards** - Apply spacing scale
- [ ] **Badges** - Use color tokens
- [ ] **Inputs** - Standardize sizing
- [ ] **Modals** - Apply glassmorphism styles

### Medium Priority Components
- [ ] **Lists** - Standardize item spacing
- [ ] **Navigation** - Apply spacing tokens
- [ ] **Headers** - Standardize typography
- [ ] **Footers** - Apply spacing scale
- [ ] **Sidebars** - Use theme colors

### Low Priority Components
- [ ] **Tooltips** - Standardize styling
- [ ] **Dropdowns** - Apply spacing
- [ ] **Tabs** - Standardize design
- [ ] **Accordions** - Apply spacing
- [ ] **Progress bars** - Use color tokens

---

## Phase 3: Icon Standardization (Week 3)

### Icon Size Migration
- [ ] Find all non-standard icon sizes (15px, 22px, etc.)
- [ ] Replace with standard sizes (12, 14, 16, 18, 20, 24, 32, 48)
- [ ] Add flex-shrink-0 to all icons in flex containers
- [ ] Test icon alignment across components

### Icon Button Migration
- [ ] Apply icon-btn utility class
- [ ] Add aria labels to all icon buttons
- [ ] Test keyboard navigation
- [ ] Verify focus states

---

## Phase 4: Color Token Migration (Week 4)

### Replace Hardcoded Colors
- [ ] Find all instances of bg-gray-900, bg-gray-800, etc.
- [ ] Replace with bg-clawd-bg, bg-clawd-surface
- [ ] Find all text-gray-400, text-gray-300, etc.
- [ ] Replace with text-clawd-text, text-clawd-text-dim
- [ ] Test light/dark theme switching
- [ ] Verify contrast ratios

### Status Color Migration
- [ ] Replace success colors with --color-success
- [ ] Replace error colors with --color-error
- [ ] Replace warning colors with --color-warning
- [ ] Replace info colors with --color-info

---

## Phase 5: Accessibility Improvements (Week 5)

### Focus States
- [ ] Add focus rings to all interactive elements
- [ ] Test keyboard navigation flow
- [ ] Verify focus is always visible
- [ ] Test with screen reader

### Contrast Ratios
- [ ] Verify all text meets 4.5:1 minimum
- [ ] Test with contrast checker tools
- [ ] Fix any failing combinations
- [ ] Document exceptions (if any)

### Aria Labels
- [ ] Add aria-label to all icon buttons
- [ ] Add aria-hidden to decorative icons
- [ ] Add role attributes where needed
- [ ] Test with screen reader

---

## Phase 6: Documentation & Tooling (Week 6)

### Developer Tools
- [ ] Create VS Code snippets file
- [ ] Add ESLint rules for design system
- [ ] Create Storybook setup
- [ ] Document component props

### Design Tools
- [ ] Create Figma design system file
- [ ] Export design tokens to Figma
- [ ] Create component library in Figma
- [ ] Share with design team

---

## Testing Checklist

### Visual Testing
- [ ] Test all components in light theme
- [ ] Test all components in dark theme
- [ ] Test responsive breakpoints
- [ ] Test print styles
- [ ] Test reduced motion mode
- [ ] Test high contrast mode

### Functional Testing
- [ ] Test keyboard navigation
- [ ] Test screen reader compatibility
- [ ] Test focus management
- [ ] Test color contrast
- [ ] Test animation performance

---

## Component Audit Progress

Track which components have been migrated to design system standards:

### ✅ Compliant Components
- [x] LoadingStates.tsx - Uses standard patterns
- [ ] ... (add as components are migrated)

### ⚠️ Needs Migration
- [ ] Kanban.tsx - Some non-standard icon sizes
- [ ] Dashboard.tsx - Mixed spacing patterns
- [ ] ... (add as issues are found)

### ❌ Non-Compliant
- [ ] ... (components with major issues)

---

## Migration Script Template

Use this template for migrating components:

```bash
# 1. Backup original component
cp src/components/MyComponent.tsx src/components/MyComponent.tsx.backup

# 2. Find hardcoded colors
grep -n "bg-gray\|text-gray\|border-gray" src/components/MyComponent.tsx

# 3. Find non-standard icon sizes
grep -n "size={[0-9]*}" src/components/MyComponent.tsx

# 4. Find spacing issues
grep -n "gap-5\|p-5\|m-5" src/components/MyComponent.tsx

# 5. Make changes

# 6. Test component
npm run test src/components/MyComponent.test.tsx

# 7. Visual test
npm run dev
```

---

## Quick Migration Examples

### Before → After Examples

#### Colors
```jsx
// ❌ Before
<div className="bg-gray-900 text-white border-gray-700">

// ✅ After
<div className="bg-clawd-surface text-clawd-text border-clawd-border">
```

#### Icons
```jsx
// ❌ Before
<Icon size={15} />

// ✅ After
<Icon size={16} className="flex-shrink-0" />
```

#### Spacing
```jsx
// ❌ Before
<div className="gap-5 p-5">

// ✅ After
<div className="gap-4 p-4">
```

#### Icon Buttons
```jsx
// ❌ Before
<button className="p-2 rounded hover:bg-gray-800">
  <Settings size={20} />
</button>

// ✅ After
<button className="icon-btn" aria-label="Settings">
  <Settings size={20} aria-hidden="true" />
</button>
```

---

## Success Metrics

Track these metrics to measure progress:

### Code Quality
- [ ] 100% of components use CSS variables
- [ ] 100% of icons use standard sizes
- [ ] 100% of icon buttons have aria labels
- [ ] 90%+ spacing uses scale values
- [ ] All text meets 4.5:1 contrast

### Performance
- [ ] No regressions in lighthouse scores
- [ ] All animations under 16ms frame time
- [ ] Bundle size increase < 5%

### Accessibility
- [ ] WCAG AA compliance achieved
- [ ] Screen reader tested
- [ ] Keyboard navigation tested
- [ ] Focus management verified

---

## Resources

- **Documentation:** `DESIGN_SYSTEM.md`
- **Quick Reference:** `DESIGN_SYSTEM_QUICKSTART.md`
- **Component Examples:** `COMPONENT_LIBRARY.md`
- **CSS Variables:** `src/design-tokens.css`

---

## Notes

### Common Issues
- **Icon misalignment** - Add `flex-shrink-0`
- **Wrong spacing** - Use scale values (2, 4, 6)
- **Theme not working** - Check CSS variable usage
- **Poor contrast** - Use text-clawd-text-dim instead of text-gray-400

### Best Practices
- Always test in both light and dark themes
- Verify accessibility after changes
- Use utility classes when available
- Keep custom CSS minimal
- Document any exceptions

---

**Last Updated:** 2026-01-29  
**Status:** Phase 1 in progress  
**Next Review:** Weekly
