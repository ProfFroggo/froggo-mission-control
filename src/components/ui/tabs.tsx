import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/cn';

export const Tabs = TabsPrimitive.Root;

/**
 * TabsList — transparent flex row with bottom border.
 * Active TabsTrigger uses -mb-px to overlap this border with its own border-b-2.
 * Canonical pattern: border-b-2 underline on active, transparent on inactive.
 * Use this for main app navigation tabs.
 */
export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'flex items-center gap-1 border-b border-mission-control-border bg-mission-control-surface',
      className
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

/**
 * TabsTrigger — border-b-2 underline style.
 * Active: accent-colored text + accent border underline.
 * Inactive: dimmed text, transparent border, hover lightens.
 */
export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap',
      'border-b-2 -mb-px transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mission-control-accent/50 focus-visible:ring-inset',
      'disabled:pointer-events-none disabled:opacity-40',
      'data-[state=inactive]:border-transparent data-[state=inactive]:text-mission-control-text-dim data-[state=inactive]:hover:text-mission-control-text',
      'data-[state=active]:border-[var(--mission-control-accent)] data-[state=active]:text-mission-control-accent',
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

/**
 * SegmentedTabsList — bordered container segment control style.
 * Use this for inline segment controls (e.g. filter toggles, view switchers).
 * NOT for main navigation — use TabsList/TabsTrigger for that.
 */
export const SegmentedTabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'inline-flex items-center gap-1 rounded-lg bg-mission-control-border/30 p-1',
      className
    )}
    {...props}
  />
));
SegmentedTabsList.displayName = 'SegmentedTabsList';

/**
 * SegmentedTabsTrigger — pill/card style for segment controls.
 * Active: solid surface bg with text shadow.
 * Inactive: transparent, dimmed text.
 */
export const SegmentedTabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'flex items-center gap-2 px-3 py-1.5 text-sm font-medium whitespace-nowrap rounded-md',
      'transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mission-control-accent/50',
      'disabled:pointer-events-none disabled:opacity-40',
      'data-[state=inactive]:text-mission-control-text-dim data-[state=inactive]:hover:text-mission-control-text',
      'data-[state=active]:bg-mission-control-surface data-[state=active]:text-mission-control-text data-[state=active]:shadow-sm',
      className
    )}
    {...props}
  />
));
SegmentedTabsTrigger.displayName = 'SegmentedTabsTrigger';

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn('focus-visible:outline-none', className)}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;
