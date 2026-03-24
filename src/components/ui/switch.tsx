import * as React from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { cn } from '@/lib/cn';

export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    className={cn(
      'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-glass-border',
      'transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mission-control-accent/50',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'data-[state=unchecked]:bg-glass data-[state=checked]:bg-mission-control-accent data-[state=checked]:border-mission-control-accent',
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        'pointer-events-none block h-3.5 w-3.5 rounded-full shadow-sm ring-0 transition-transform duration-150',
        'data-[state=unchecked]:translate-x-0.5 data-[state=checked]:translate-x-[18px]',
        'data-[state=unchecked]:bg-mission-control-text-dim data-[state=checked]:bg-white'
      )}
    />
  </SwitchPrimitive.Root>
));
Switch.displayName = SwitchPrimitive.Root.displayName;
