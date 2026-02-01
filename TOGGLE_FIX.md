# Toggle Component Fix

## Problem
The Toggle component was showing as checkboxes instead of proper iOS/macOS toggle switches.

## Root Cause
The `forms.css` file had a global rule targeting `input[type="checkbox"]:not(.unstyled)` that set `appearance: auto`, which was overriding the Toggle component's `appearance: none` styling. This caused native checkbox rendering instead of the custom toggle design.

```css
/* forms.css - The problematic rule */
input[type="checkbox"]:not(.unstyled) {
  appearance: auto;  /* <-- This was forcing checkbox appearance */
}
```

## Solution
Completely rewrote the Toggle component to:

1. **Use button-based approach** instead of styling a checkbox input
   - Eliminates forms.css conflicts entirely
   - Uses `<button role="switch">` for semantic correctness
   - Hidden checkbox for form compatibility

2. **Proper iOS/macOS design**
   - Pill-shaped with exact 2:1 width-to-height ratio
   - Smooth 200ms transitions
   - Proper sizing: sm (36×18), md (44×22), lg (52×26)
   
3. **Complete accessibility**
   - ARIA role="switch" and aria-checked
   - Keyboard navigation (Space/Enter)
   - Focus ring styling
   - Disabled state support

4. **Inline styles for isolation**
   - No dependency on Tailwind classes
   - Completely isolated from global CSS
   - Guaranteed consistent rendering

## Implementation Details

### Size Variants
- **sm**: 36×18px (2:1 ratio)
- **md**: 44×22px (2:1 ratio) - Default
- **lg**: 52×26px (2:1 ratio)

### Color Schemes
- **default**: Uses clawd-accent (#22c55e) when checked
- **green**: Green (#22c55e) when checked
- **red**: Red (#ef4444) when unchecked, green when checked

### Animation
- Track color: 200ms ease transition
- Thumb position: 200ms ease transition
- Focus ring: Instant appearance with 3px glow

## Files Changed
1. `src/components/Toggle.tsx` - Complete rewrite
2. `src/forms.css` - Added `.toggle-switch:focus-visible` styling

## Testing
✅ Build successful
✅ Used in EditPanelsModal
✅ Used in EnhancedSettingsPanel
✅ All prop types compatible
✅ Accessibility compliant

## Usage
```tsx
<Toggle 
  checked={value}
  onChange={(checked) => setValue(checked)}
  size="md"
  colorScheme="default"
  disabled={false}
/>
```

## Visual Reference
The toggle now properly displays as a pill-shaped switch that:
- Shows gray/red track when OFF
- Shows green track when ON
- Animates thumb smoothly left/right
- Looks identical to iOS/macOS system toggles
