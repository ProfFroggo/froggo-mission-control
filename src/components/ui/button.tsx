import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mission-control-accent/50 disabled:pointer-events-none disabled:opacity-40 select-none',
  {
    variants: {
      variant: {
        default:
          'bg-mission-control-accent text-white hover:bg-mission-control-accent-dim shadow-sm active:scale-[0.98]',
        secondary:
          'bg-mission-control-surface border border-mission-control-border text-mission-control-text hover:bg-mission-control-border/40 hover:border-mission-control-border shadow-sm active:scale-[0.98]',
        ghost:
          'text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 active:bg-mission-control-border/60',
        destructive:
          'bg-error/10 text-error border border-error/20 hover:bg-error/20 hover:border-error/30 active:scale-[0.98]',
        outline:
          'border border-mission-control-border text-mission-control-text bg-mission-control-surface hover:bg-mission-control-border/40 active:scale-[0.98]',
        link:
          'text-mission-control-accent underline-offset-4 hover:underline p-0 h-auto',
        glass:
          'bg-mission-control-surface border border-mission-control-border text-mission-control-text hover:bg-mission-control-border/40 shadow-sm active:scale-[0.98]',
        'glass-accent':
          'bg-mission-control-accent/10 border border-mission-control-accent/20 text-mission-control-accent hover:bg-mission-control-accent/15 hover:border-mission-control-accent/30 active:scale-[0.98]',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-7 px-3 text-xs rounded-md',
        lg: 'h-11 px-6 text-base rounded-xl',
        icon: 'h-9 w-9',
        'icon-sm': 'h-7 w-7 rounded-md',
        'icon-lg': 'h-11 w-11 rounded-xl',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = 'Button';
