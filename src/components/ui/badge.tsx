import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

export const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors select-none',
  {
    variants: {
      variant: {
        default:   'bg-mission-control-border/40 border-mission-control-border text-mission-control-text',
        primary:   'bg-[var(--mission-control-accent)]/12 border-[var(--mission-control-accent)]/25 text-mission-control-accent',
        secondary: 'bg-mission-control-surface border-mission-control-border text-mission-control-text-dim',
        success:   'bg-[var(--color-success)]/10 border-[var(--color-success)]/20 text-[var(--color-success)]',
        error:     'bg-[var(--color-error)]/10 border-[var(--color-error)]/20 text-[var(--color-error)]',
        warning:   'bg-[var(--color-warning)]/10 border-[var(--color-warning)]/20 text-[var(--color-warning)]',
        info:      'bg-[var(--color-info)]/10 border-[var(--color-info)]/20 text-[var(--color-info)]',
        outline:   'border-mission-control-border text-mission-control-text bg-transparent',
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
