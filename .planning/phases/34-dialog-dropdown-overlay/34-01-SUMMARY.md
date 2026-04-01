# Phase 34: Dialog, Dropdown & Overlay Migration

## Status: COMPLETE (2026-03-24)

## What Was Done

### BaseModal.tsx — Radix Themes Dialog
- Replaced custom backdrop+panel+focus-trap implementation with `Dialog.Root` + `Dialog.Content`
- Removed `useFocusTrap` import (Radix handles this natively)
- Kept identical external API: `isOpen`, `onClose`, `size`, `maxWidth`, `maxHeight`, `showCloseButton`, `closeButtonPosition`, `preventBackdropClose`, `preventEscClose`, `ariaLabel`, `ariaLabelledby`, `ariaDescribedby`, `className` props
- Size mapping: sm→400px, md→560px, lg→720px, xl→900px, 2xl→1100px, full→95vw
- Added `VisuallyHidden` wrapper with `Dialog.Title` + `Dialog.Description` for accessibility (consumers provide their own visible headings)
- Floating close button position uses `IconButton variant="ghost" color="gray" size="2"`
- `BaseModalHeader` close button migrated from raw `<button>` to `IconButton size="2" variant="ghost" color="gray"`
- `onClosingStart` / `onClosingComplete` callbacks preserved, called from `handleOpenChange`

### PanelHeader.tsx — Radix Button
- Action buttons migrated from raw `<button>` to Radix `Button` component
- Variant mapping: primary→solid/grass, ghost→ghost/gray, secondary→surface/gray
- Size `"2"` for consistent sizing

## All 14 BaseModal consumers unaffected (same props API).

## Build: PASS
