# Tailwind → Radix Themes Mapping Reference
## Radix Themes Version: 3.3.0
## Available Layout Components: Box, Flex, Grid, Container, Section, Text, Heading, Inset

---

## Spacing Scale Alignment

Radix uses a 1–9 token scale. Map from Tailwind values:

| Tailwind | px value | Radix token | Notes |
|----------|----------|-------------|-------|
| 0.5, px  | 2px      | style={{}}  | No token — use style prop |
| 1        | 4px      | "1"         | exact |
| 2        | 8px      | "2"         | exact |
| 3        | 12px     | "3"         | exact |
| 4        | 16px     | "4"         | exact |
| 5        | 20px     | "4"         | closest (Radix 4=16px, 5=24px) |
| 6        | 24px     | "5"         | exact |
| 8        | 32px     | "6"         | exact |
| 10       | 40px     | "7"         | exact |
| 12       | 48px     | "8"         | exact |
| 16       | 64px     | "9"         | exact |
| 0        | 0        | style={{}}  | Zero — no token |

---

## Typography Scale Alignment

Radix Text/Heading size prop 1–9:

| Tailwind     | px value | Radix size   | Component    |
|--------------|----------|--------------|--------------|
| text-xs      | 12px     | size="1"     | Text         |
| text-sm      | 14px     | size="2"     | Text         |
| text-base    | 16px     | size="3"     | Text         |
| text-lg      | 18px     | size="4"     | Text/Heading |
| text-xl      | 20px     | size="5"     | Text/Heading |
| text-2xl     | 24px     | size="6"     | Heading      |
| text-3xl     | 30px     | size="7"     | Heading      |
| text-4xl     | 36px     | size="8"     | Heading      |
| font-normal  | 400      | weight="regular" | Text prop |
| font-medium  | 500      | weight="medium"  | Text prop |
| font-semibold| 600      | weight="bold"    | Text prop (no semibold token) |
| font-bold    | 700      | weight="bold"    | Text prop |
| truncate     | -        | truncate         | Text prop |
| text-center  | -        | align="center"   | Text prop |
| text-left    | -        | align="left"     | Text prop |
| text-right   | -        | align="right"    | Text prop |

**NOT migrated to Text (keep in className):**
- font-mono — no Radix prop
- tracking-*, leading-* — no Radix prop
- uppercase, lowercase, capitalize — no Radix prop
- tabular-nums — no Radix prop
- text-[10px], text-[8px] — arbitrary, use style={{fontSize:'10px'}}

---

## Layout Component Mapping

### Box — generic block container
Use when the element is a div with padding/margin/sizing but NO flex/grid behavior.
```tsx
// Before
<div className="p-4">
// After
<Box p="4">

// Before
<div className="px-6 py-4">
// After
<Box px="5" py="4">

// Before
<div className="w-full">
// After
<Box width="100%">

// Before
<div className="flex-1 overflow-hidden">
// After
<Box flexGrow="1" className="overflow-hidden">
```

### Flex — replaces div with flex behavior
Use whenever className contains "flex".
```tsx
// Before
<div className="flex">
// After
<Flex>

// Before
<div className="flex flex-col">
// After
<Flex direction="column">

// Before
<div className="flex items-center">
// After
<Flex align="center">

// Before
<div className="flex items-center justify-between">
// After
<Flex align="center" justify="between">

// Before
<div className="flex items-center gap-2">
// After
<Flex align="center" gap="2">

// Before
<div className="flex flex-col gap-4 p-4">
// After
<Flex direction="column" gap="4" p="4">

// Before
<div className="flex items-center gap-3 px-4 py-3 border-b border-mission-control-border">
// After
<Flex align="center" gap="3" px="4" py="3" className="border-b border-mission-control-border">

// Before
<div className="flex-1 overflow-hidden">
// After
<Box flexGrow="1" className="overflow-hidden">
// Note: overflow-* is non-migratable — stays in className

// Before
<div className="flex h-full">
// After
<Flex height="100%">

// Before
<div className="flex flex-wrap gap-2">
// After
<Flex wrap="wrap" gap="2">
```

### Flex props reference:
- direction: "row" | "column" | "row-reverse" | "column-reverse"
- align: "start" | "center" | "end" | "stretch" | "baseline"
- justify: "start" | "center" | "end" | "between" | "around" | "evenly"
- wrap: "nowrap" | "wrap" | "wrap-reverse"
- gap, gapX, gapY: "1"–"9"
- p, px, py, pt, pr, pb, pl: "1"–"9"
- m, mx, my, mt, mr, mb, ml: "1"–"9"
- width, height, minWidth, maxWidth, minHeight, maxHeight: CSS string values
- flexGrow: "0" | "1"
- flexShrink: "0" | "1"
- asChild: boolean (renders as child element)

### Grid — replaces div with grid behavior
```tsx
// Before
<div className="grid grid-cols-3 gap-4">
// After
<Grid columns="3" gap="4">

// Before
<div className="grid grid-cols-2 gap-6">
// After
<Grid columns="2" gap="5">

// Before
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
// After (Radix responsive syntax):
<Grid columns={{ initial: "1", md: "2", lg: "3" }} gap="4">
```

### Grid props reference:
- columns: string | responsive object (e.g. "3" or { initial: "1", md: "2" })
- rows: string | responsive object
- gap, gapX, gapY: "1"–"9"
- p, px, py: "1"–"9"
- width, height: CSS string values

### Text — replaces typography spans/paragraphs
```tsx
// Before
<span className="text-sm text-mission-control-text-dim">label</span>
// After
<Text size="2" className="text-mission-control-text-dim">label</Text>
// Note: mission-control color classes always stay in className

// Before
<p className="text-sm font-medium">
// After
<Text size="2" weight="medium" as="p">

// Before
<span className="text-xs font-semibold uppercase tracking-wider text-mission-control-text-dim">
// After
<Text size="1" weight="bold" className="uppercase tracking-wider text-mission-control-text-dim">
```

### Heading — replaces heading elements
```tsx
// Before
<h3 className="text-lg font-semibold">
// After
<Heading size="4" as="h3">

// Before
<h2 className="text-xl font-bold text-mission-control-text">
// After
<Heading size="5" as="h2" weight="bold" className="text-mission-control-text">
```

---

## Non-Migratable Patterns — Keep in className

These have no Radix prop equivalent. Always pass via className="...":

| Pattern | Keep as | Reason |
|---------|---------|--------|
| overflow-hidden, overflow-auto, overflow-y-auto | className | No Radix prop |
| relative, absolute, fixed, sticky | className | No Radix prop (use Box with className) |
| top-*, left-*, right-*, bottom-*, inset-* | className | Positional — no prop |
| z-*, z-[*] | className | Z-index — no prop |
| cursor-pointer, cursor-default | className | No Radix prop |
| pointer-events-none | className | No Radix prop |
| opacity-* | className | No Radix prop |
| whitespace-nowrap, whitespace-pre-wrap | className | No Radix prop |
| sr-only | className | Accessibility — no prop |
| transition-*, duration-*, ease-* | className | Animation — use design tokens |
| animate-* | className | No Radix prop |
| border-b-2, border-t-2 (underline tabs) | className | Tab pattern — intentional |
| -mb-px, -mt-px | className | Negative margin for tab overlap |
| col-span-*, row-span-* | className | Grid item span — no Radix prop yet |
| select-none | className | No Radix prop |
| resize-none | className | No Radix prop |
| rounded-*, rounded-lg, rounded-full | className | Radix uses theme radius, not classes |
| border (bare), border-b, border-t, border-l, border-r | className | No Radix border prop |
| uppercase, tracking-*, leading-* | className | Typography modifier — no Radix prop |
| font-mono | className | No Radix monospace weight |
| tabular-nums | className | No Radix prop |
| shadow-*, ring-* | className | No Radix prop |
| inline-flex | className | No Radix component for inline variant |
| h-3/h-4/w-3/w-4 (icon sizes) | className | Fixed icon dimensions |
| py-0, mt-0, mb-0, gap-0 | style={{}} or className | Zero values have no Radix token |

---

## ALWAYS KEEP — Mission Control Design System Classes

These look like Tailwind but are custom design system utilities — NEVER migrate them:

```
bg-mission-control-*       → all backgrounds
text-mission-control-*     → all text colors
border-mission-control-*   → all borders
text-success, text-error, text-warning, text-info, text-review, text-muted, text-danger
bg-success, bg-error, bg-warning, bg-info, bg-review, bg-danger
border-success, border-error, border-warning, border-info, border-review
focus-ring, transition-fast, transition-normal, transition-slow
text-display, text-heading-1, text-heading-2, text-heading-3, text-body, text-secondary, text-caption
```

---

## Arbitrary Value Handling

Tailwind arbitrary values (w-[200px], h-[calc(100%-4rem)]) → always use style={{}} in Radix:
```tsx
// Before
<div className="w-[340px] h-[calc(100vh-60px)]">
// After
<Box style={{ width: '340px', height: 'calc(100vh - 60px)' }}>

// Before
<span className="text-[10px]">
// After
<Text style={{ fontSize: '10px' }}>

// Before
<div className="min-w-[220px]">
// After — keep in className since it's already in a non-Flex container
<Box className="min-w-[220px]">
// OR if the parent is already Radix, add to its style prop
```

CSS variable arbitrary values stay in className:
```tsx
// These stay as-is (CSS variables in classNames):
className="bg-[--accent-9]"
className="text-[--accent-11]"
```
