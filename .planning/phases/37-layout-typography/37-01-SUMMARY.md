# Phase 37: Layout & Typography

## Status: COMPLETE (2026-03-24)

## What Was Done

### PanelHeader.tsx — Radix Heading + Text
- Added `Heading` and `Text` to `@radix-ui/themes` import
- Replaced `titleStyles` / `subtitleStyles` CSS class maps with Radix size maps:
  - Title: compact→size "3", default→size "4", large→size "5"
  - Subtitle: compact→size "1", default/large→size "2"
- `<h1>` replaced with `<Heading size={titleSize[variant]} weight="medium" as="h1">`
- Subtitle `<div>` replaced with `<Text size={subtitleSize[variant]} color="gray" as="div">`

### BaseModal.tsx (BaseModalHeader) — Radix Heading + Text
- Added `Heading` and `Text` to `@radix-ui/themes` import
- `<h2>` in BaseModalHeader replaced with `<Heading id={titleId} size="4" weight="bold" as="h2">`
- Subtitle `<p>` replaced with `<Text size="2" color="gray" as="p">`
- Note: `weight="semibold"` is not a valid Radix Heading weight — used `"bold"` instead (Radix accepts: bold, medium, light, regular)

## Build: PASS
