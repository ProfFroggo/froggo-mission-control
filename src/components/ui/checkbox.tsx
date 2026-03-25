import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';

export const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      'peer h-4 w-4 shrink-0 rounded border border-mission-control-border',
      'bg-mission-control-surface',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mission-control-accent/50',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'data-[state=checked]:bg-mission-control-accent data-[state=checked]:border-mission-control-accent data-[state=checked]:text-white',
      'transition-colors duration-150',
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
      <Check size={11} strokeWidth={2.5} />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;
