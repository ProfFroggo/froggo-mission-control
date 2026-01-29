# Modal System Standardization Status

**Last Updated:** 2026-01-29  
**Task:** task-1769688719022 (P2)

## ✅ Completed

### BaseModal Improvements
- **Consistent padding**: All header/body/footer now use `p-6` (removed responsive `sm:p-6` variation for consistency)
- **Enhanced close button**: Added hover state for better visibility
- **BaseModalButton component**: New standardized button component with variants (primary, secondary, danger, ghost) and sizes (sm, md, lg)
- **Improved footer**: Added `flex-wrap` for better responsive behavior
- **Existing animations**: Modal animations already defined in `index.css`:
  - `modal-backdrop-enter/exit` - fade in/out with blur
  - `modal-content-enter/exit` - scale + translateY with smooth cubic-bezier easing
  - Backdrop: 200ms enter, 150ms exit
  - Content: 200ms enter, 150ms exit

### Refactored Modals
- **ContactModal**: Completely refactored to use BaseModal components
  - Replaced custom backdrop/container with BaseModal
  - Using BaseModalHeader with proper icon and close button
  - Using BaseModalBody with proper scrolling
  - Using BaseModalFooter with BaseModalButton for actions
  - Removed duplicate ESC handling (BaseModal handles it)
  - Status message properly positioned

### Already Standardized
- **QuickModals.tsx**: Already using BaseModal components correctly
- **SnoozeModal.tsx**: Already using BaseModal components correctly
- **TaskModal.tsx**: Uses BaseModal but has custom mode selector (acceptable)

## 🔨 Needs Refactoring

### AgentDetailModal
**Status:** Not using BaseModal  
**Issues:**
- Custom modal backdrop/container implementation
- Custom close button and ESC handling
- Manual animation classes
- Custom tab navigation (acceptable to keep)

**Recommendation:** Refactor to use BaseModal components while keeping custom tab navigation

### Other Modals to Check
- **AgentChatModal.tsx** - Needs review
- **AgentCompareModal.tsx** - Needs review
- **AccountDetailModal.tsx** - Needs review
- **WorkerModal.tsx** - Needs review
- **SkillModal.tsx** - Needs review
- **FilePreviewModal.tsx** - Needs review
- **CalendarFilterModal.tsx** - Needs review
- **NotificationSettingsModal.tsx** - Needs review

## 📋 Standardization Checklist

For each modal that needs refactoring:

1. **Import BaseModal components**:
   ```tsx
   import BaseModal, { BaseModalHeader, BaseModalBody, BaseModalFooter, BaseModalButton } from './BaseModal';
   ```

2. **Replace custom structure** with:
   ```tsx
   <BaseModal isOpen={isOpen} onClose={onClose} size="md" ariaLabel="...">
     <BaseModalHeader title="..." icon={...} onClose={onClose} />
     <BaseModalBody>
       {/* Content */}
     </BaseModalBody>
     <BaseModalFooter>
       <BaseModalButton onClick={onClose}>Cancel</BaseModalButton>
       <BaseModalButton variant="primary" onClick={...}>Confirm</BaseModalButton>
     </BaseModalFooter>
   </BaseModal>
   ```

3. **Remove custom handlers**:
   - ESC key handling (BaseModal does this)
   - Backdrop click handling (BaseModal does this)
   - Focus trapping (BaseModal does this)
   - Body scroll locking (BaseModal does this)

4. **Consistent spacing**:
   - Header/Footer: `p-6` (automatic)
   - Body: `p-6` (automatic, use `noPadding` if custom layout needed)
   - Gaps: `gap-3` for buttons

5. **Button standardization**:
   - Use `BaseModalButton` for all actions
   - Variants: `primary` (accent), `secondary` (default), `danger` (red), `ghost` (transparent)
   - Sizes: `sm`, `md` (default), `lg`

## 🎨 Design Tokens

### Sizes
- `sm`: max-w-sm (384px)
- `md`: max-w-md (448px) - **default**
- `lg`: max-w-2xl (672px)
- `xl`: max-w-4xl (896px)
- `2xl`: max-w-6xl (1152px)
- `full`: max-w-[95vw]

### Spacing
- Padding: `p-6` (24px) - consistent across header/body/footer
- Button gap: `gap-3` (12px)
- Max height: `90vh` (default)

### Animations
- Backdrop: fade + blur (200ms enter, 150ms exit)
- Content: scale(0.95) + translateY(-10px) (200ms cubic-bezier)
- Easing: `cubic-bezier(0.16, 1, 0.3, 1)` for natural feel

## 🚀 Performance Notes

- Backdrop blur: 12px (optimal for glassmorphism without lag)
- Modal z-index: 100 (consistent layering)
- Animation duration: 200ms (feels snappy without jarring)
- Focus trap: Efficient querySelector with caching

## 📖 Usage Examples

### Simple Modal
```tsx
<BaseModal isOpen={isOpen} onClose={onClose} ariaLabel="Confirm Action">
  <BaseModalHeader title="Confirm" onClose={onClose} />
  <BaseModalBody>
    <p>Are you sure you want to continue?</p>
  </BaseModalBody>
  <BaseModalFooter>
    <BaseModalButton onClick={onClose}>Cancel</BaseModalButton>
    <BaseModalButton variant="primary" onClick={handleConfirm}>
      Confirm
    </BaseModalButton>
  </BaseModalFooter>
</BaseModal>
```

### Modal with Icon & Subtitle
```tsx
<BaseModal isOpen={isOpen} onClose={onClose} size="lg">
  <BaseModalHeader
    title="Settings"
    subtitle="Configure your preferences"
    icon={<Settings size={24} className="text-clawd-accent" />}
    onClose={onClose}
  />
  <BaseModalBody>
    {/* Settings form */}
  </BaseModalBody>
  <BaseModalFooter>
    <BaseModalButton onClick={onClose}>Cancel</BaseModalButton>
    <BaseModalButton variant="primary" onClick={handleSave} loading={saving}>
      Save Changes
    </BaseModalButton>
  </BaseModalFooter>
</BaseModal>
```

### Full Height Modal
```tsx
<BaseModal isOpen={isOpen} onClose={onClose} size="xl" maxHeight="90vh">
  <BaseModalHeader title="Data" onClose={onClose} />
  <BaseModalBody noPadding className="flex-1">
    <div className="h-full overflow-auto p-6">
      {/* Scrollable content */}
    </div>
  </BaseModalBody>
  <BaseModalFooter align="left">
    <BaseModalButton onClick={onClose}>Close</BaseModalButton>
  </BaseModalFooter>
</BaseModal>
```

## 🎯 Next Steps

1. **Immediate (P1)**:
   - Refactor AgentDetailModal to use BaseModal
   - Quick audit of remaining 8 modals

2. **Short-term (P2)**:
   - Add modal size variants if needed
   - Consider modal scroll behavior options

3. **Future Enhancements**:
   - Modal stacking management (multiple modals)
   - Modal drawer variant (slide from side)
   - Modal fullscreen variant
   - Modal persistence (stay open on outside click)
   - Modal keyboard navigation improvements

## 📝 Migration Guide

When refactoring a modal:

1. **Before**: Custom backdrop + container
   ```tsx
   <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} />
   <div className="fixed inset-0 z-50 flex items-center justify-center">
     <div className="glass-modal rounded-xl w-full max-w-3xl">
       {/* content */}
     </div>
   </div>
   ```

2. **After**: BaseModal
   ```tsx
   <BaseModal isOpen={isOpen} onClose={onClose} size="xl">
     {/* content */}
   </BaseModal>
   ```

3. **Benefits**:
   - Consistent animations
   - Built-in accessibility (ARIA, focus trap, ESC handling)
   - Reduced code duplication
   - Easier maintenance
   - Better performance (optimized handlers)

---

**Status**: ✅ Core standardization complete | 🔄 Additional modals need review
