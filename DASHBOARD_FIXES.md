# Dashboard Light Mode Fixes

## Issues Found

### 1. **Hard-coded Text Colors**
- `text-green-300`, `text-red-300`, `text-orange-300` - Too light for light mode backgrounds
- `text-white` - Invisible on white backgrounds
- `text-blue-100`, `text-purple-100`, `text-yellow-100` - Poor contrast in light mode
- `text-zinc-400`, `text-gray-400` - Not theme-aware

### 2. **Hard-coded Background Colors**
- `bg-green-500/20`, `bg-red-500/20` etc - Need light mode alternatives
- Gradient colors in quick action buttons need adjustment

### 3. **Border Colors**
- `border-green-500/30` etc - May need light mode variants

## Solution: Theme-Aware Color Classes

### Status Pills (Connection, Urgent, etc.)
**Before:** `text-green-300`  
**After:** `text-green-600 dark:text-green-300`

### Quick Action Buttons
**Before:** `text-white`, `text-blue-100`  
**After:** Use appropriate contrast for both modes

### Stats Cards
**Before:** Hard-coded colors  
**After:** Theme-aware with proper contrast

### General Text
**Before:** `text-zinc-400`  
**After:** `text-clawd-text-dim` (CSS variable)

## Fix Strategy

1. Replace all hard-coded text colors with theme-aware variants
2. Use Tailwind's `dark:` prefix for dark-mode specific styles
3. Use CSS variables where possible for consistency
4. Test both modes after each section fixed
