import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

export const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors select-none',
  {
    variants: {
      variant: {
        default:   'bg-mission-control-accent/15 border-mission-control-accent/25 text-mission-control-accent',
        secondary: 'bg-glass border-glass-border text-mission-control-text-dim',
        glass:     'bg-glass border-glass-border text-mission-control-text backdrop-blur-sm',
        success:   'bg-success/10 border-success/20 text-success',
        error:     'bg-error/10 border-error/20 text-error',
        warning:   'bg-warning/10 border-warning/20 text-warning',
        info:      'bg-info/10 border-info/20 text-info',
        outline:   'border-glass-border-strong text-mission-control-text bg-transparent',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
