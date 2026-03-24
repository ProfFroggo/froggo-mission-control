import * as React from 'react';
import { cn } from '@/lib/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        'flex h-9 w-full rounded-lg px-3 py-2 text-sm',
        'bg-glass border border-glass-border backdrop-blur-sm',
        'text-mission-control-text placeholder:text-mission-control-text-dim/40',
        'hover:border-glass-border-hover',
        'focus:outline-none focus:ring-2 focus:ring-mission-control-accent/40 focus:border-mission-control-accent/40',
        'disabled:cursor-not-allowed disabled:opacity-40',
        'transition-colors',
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Input.displayName = 'Input';
