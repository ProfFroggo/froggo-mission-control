import { ReactNode } from 'react';
import { Tooltip as RadixTooltip, IconButton } from '@radix-ui/themes';

interface TooltipProps {
  content: string | ReactNode;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  maxWidth?: number;
  disabled?: boolean;
  showArrow?: boolean;
}

/**
 * Tooltip component for inline contextual help
 * Wraps Radix Themes Tooltip.
 * Usage: <Tooltip content="Help text">Hover me</Tooltip>
 */
export default function Tooltip({
  content,
  children,
  position = 'top',
  delay: _delay = 500,
  maxWidth: _maxWidth = 250,
  disabled = false,
  showArrow: _showArrow = true,
}: TooltipProps) {
  if (disabled) {
    return <>{children}</>;
  }

  // Radix Tooltip requires content to be a string
  const tooltipContent = typeof content === 'string' ? content : undefined;

  return (
    <RadixTooltip content={tooltipContent ?? ''} side={position}>
      <span style={{ display: 'inline-block' }}>
        {children}
      </span>
    </RadixTooltip>
  );
}

/**
 * Help tooltip with icon - shows help icon that reveals tooltip on hover
 */
export function HelpTooltip({ content, position = 'top' }: { content: string | ReactNode; position?: 'top' | 'bottom' | 'left' | 'right' }) {
  const tooltipContent = typeof content === 'string' ? content : '';
  return (
    <RadixTooltip content={tooltipContent} side={position}>
      <IconButton
        size="1"
        variant="soft"
        color="gray"
        radius="full"
        aria-label="Help"
      >
        <span className="text-xs">?</span>
      </IconButton>
    </RadixTooltip>
  );
}
