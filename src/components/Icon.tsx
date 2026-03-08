/**
 * Icon Component - Enforces consistent icon sizing across dashboard
 * 
 * Size Standards:
 * - xs (12px): Badges, inline indicators, priority markers
 * - sm (16px): Default inline icons, standard buttons, list items
 * - md (20px): Section headers, larger buttons, feature icons
 * - lg (24px): Page headers, hero sections, major features
 * - xl (32px): Empty states, hero elements, large placeholders
 * 
 * Usage:
 *   <Icon icon={CheckCircle} size="sm" />
 *   <Icon icon={Bot} size="lg" className="text-info" />
 */

import { LucideIcon } from 'lucide-react';
import { ReactNode } from 'react';

export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface IconProps {
  icon: LucideIcon;
  size?: IconSize;
  className?: string;
}

const sizeMap: Record<IconSize, number> = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
};

/**
 * Standard Icon component with enforced sizing
 */
export function Icon({ icon: IconComponent, size = 'sm', className = '' }: IconProps) {
  return (
    <IconComponent 
      size={sizeMap[size]} 
      className={`flex-shrink-0 ${className}`}
    />
  );
}

/**
 * Icon with text wrapper - ensures proper alignment
 */
interface IconTextProps {
  icon: LucideIcon;
  iconSize?: IconSize;
  gap?: 'tight' | 'normal' | 'loose';
  className?: string;
  iconClassName?: string;
  children: ReactNode;
}

export function IconText({ 
  icon, 
  iconSize = 'sm', 
  gap = 'normal',
  className = '',
  iconClassName = '',
  children 
}: IconTextProps) {
  const gapClass = {
    tight: 'gap-1.5',
    normal: 'gap-2',
    loose: 'gap-3',
  }[gap];

  return (
    <span className={`inline-flex items-center ${gapClass} ${className}`}>
      <Icon icon={icon} size={iconSize} className={iconClassName} />
      {children}
    </span>
  );
}

/**
 * Icon button wrapper - ensures proper centering and sizing
 */
interface IconButtonProps {
  icon: LucideIcon;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'ghost' | 'danger';
  disabled?: boolean;
  className?: string;
  title?: string;
  type?: 'button' | 'submit' | 'reset';
}

export function IconButton({
  icon,
  onClick,
  size = 'md',
  variant = 'default',
  disabled = false,
  className = '',
  title,
  type = 'button'
}: IconButtonProps) {
  const sizeClasses = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-3',
  };

  const iconSizes: Record<typeof size, IconSize> = {
    sm: 'xs',
    md: 'sm',
    lg: 'md',
  };

  const variantClasses = {
    default: 'bg-mission-control-surface border border-mission-control-border hover:bg-mission-control-border',
    ghost: 'hover:bg-mission-control-border',
    danger: 'text-error hover:bg-error-subtle hover:border-error-border',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`
        inline-flex items-center justify-center
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        rounded-lg
        transition-all duration-150
        active:scale-95
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
    >
      <Icon icon={icon} size={iconSizes[size]} />
    </button>
  );
}

export default Icon;
