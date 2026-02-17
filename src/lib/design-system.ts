/**
 * Design System Constants
 * Centralized design tokens for consistent UI/UX across the dashboard
 */

/**
 * ICON SIZES
 * Standard sizes for all icons throughout the dashboard
 */
export const ICON_SIZES = {
  xs: 12,   // Badges, inline indicators, priority markers
  sm: 16,   // Default inline icons, standard buttons (DEFAULT)
  md: 20,   // Section headers, larger buttons
  lg: 24,   // Page headers, hero sections
  xl: 32,   // Empty states, large placeholders
} as const;

export type IconSize = keyof typeof ICON_SIZES;

/**
 * SPACING SCALE
 * Tailwind-based spacing scale for consistency
 */
export const SPACING = {
  tight: '1.5',    // 6px  - Icon+text inline, very compact
  compact: '2',    // 8px  - Dense lists, compact layouts
  normal: '3',     // 12px - Standard spacing (DEFAULT)
  relaxed: '4',    // 16px - Comfortable spacing
  loose: '6',      // 24px - Section spacing, generous padding
} as const;

export type SpacingSize = keyof typeof SPACING;

/**
 * CARD PADDING
 * Standard padding for card components
 */
export const CARD_PADDING = {
  sm: '3',   // 12px - Small cards, compact components
  md: '4',   // 16px - Standard cards (DEFAULT)
  lg: '6',   // 24px - Large panels, main sections
} as const;

/**
 * PANEL PADDING
 * Standard padding for panel/page components
 */
export const PANEL_PADDING = {
  sm: '4',   // 16px - Compact panels
  md: '6',   // 24px - Standard panels (DEFAULT)
  lg: '8',   // 32px - Large panels, main content areas
} as const;

/**
 * BORDER RADIUS
 * Standard border radius values
 */
export const RADIUS = {
  sm: 'rounded-lg',      // 8px - Small elements, buttons
  md: 'rounded-xl',      // 12px - Cards, standard components (DEFAULT)
  lg: 'rounded-2xl',     // 16px - Large panels, hero sections
  full: 'rounded-full',  // Circular - Badges, avatars, pills
} as const;

/**
 * TRANSITION DURATIONS
 * Standard animation/transition timing
 */
export const DURATION = {
  fast: 150,    // Hover, focus, clicks
  normal: 200,  // Modals, slides, cards (DEFAULT)
  slow: 300,    // Large movements, page transitions
} as const;

/**
 * TRANSITION EASING
 * Standard easing functions for animations
 */
export const EASING = {
  in: 'ease-in',           // Exiting animations
  out: 'ease-out',         // Entering animations (DEFAULT)
  inOut: 'ease-in-out',    // Movement/transforms
} as const;

/**
 * Z-INDEX LAYERS
 * Consistent z-index stacking
 */
export const Z_INDEX = {
  base: 0,
  dropdown: 10,
  sticky: 20,
  modal: 30,
  popover: 40,
  toast: 50,
  tooltip: 60,
} as const;

/**
 * SHADOW DEPTHS
 * Standard box-shadow values for elevation
 */
export const SHADOW = {
  sm: 'shadow-sm',           // Subtle elevation
  md: 'shadow-card',         // Standard cards (DEFAULT)
  lg: 'shadow-card-lg',      // Large panels, modals
  hover: 'shadow-card-hover', // Hover state enhancement
  glow: 'shadow-glow',       // Accent/focus glow
} as const;

/**
 * SEMANTIC COLORS
 * Semantic color classes for consistent meaning
 */
export const SEMANTIC_COLORS = {
  success: {
    text: 'text-success',
    bg: 'bg-success-subtle',
    border: 'border-success-border',
  },
  error: {
    text: 'text-error',
    bg: 'bg-error-subtle',
    border: 'border-error-border',
  },
  warning: {
    text: 'text-warning',
    bg: 'bg-warning-subtle',
    border: 'border-warning-border',
  },
  info: {
    text: 'text-info',
    bg: 'bg-info-subtle',
    border: 'border-info-border',
  },
  primary: {
    text: 'text-clawd-accent',
    bg: 'bg-clawd-accent/10',
    border: 'border-clawd-accent/30',
  },
} as const;

/**
 * CHANNEL COLORS
 * Brand colors for different communication channels
 */
export const CHANNEL_COLORS = {
  discord: {
    text: 'text-[#5865F2]',
    bg: 'bg-[#5865F2]/20',
    border: 'border-[#5865F2]/30',
  },
  telegram: {
    text: 'text-[#229ED9]',
    bg: 'bg-[#229ED9]/20',
    border: 'border-[#229ED9]/30',
  },
  whatsapp: {
    text: 'text-[#25D366]',
    bg: 'bg-[#25D366]/20',
    border: 'border-[#25D366]/30',
  },
  webchat: {
    text: 'text-review',
    bg: 'bg-review-subtle',
    border: 'border-review-border',
  },
  agents: {
    text: 'text-warning',
    bg: 'bg-warning-subtle',
    border: 'border-warning-border',
  },
} as const;

/**
 * PRIORITY COLORS
 * Visual treatment for task priorities
 */
export const PRIORITY_COLORS = {
  p0: {
    text: 'text-error',
    bg: 'bg-error-subtle',
    border: 'border-error-border',
    label: 'Urgent',
  },
  p1: {
    text: 'text-warning',
    bg: 'bg-warning-subtle',
    border: 'border-warning-border',
    label: 'High',
  },
  p2: {
    text: 'text-warning',
    bg: 'bg-warning-subtle',
    border: 'border-warning-border',
    label: 'Medium',
  },
  p3: {
    text: 'text-clawd-text-dim',
    bg: 'bg-clawd-bg/20',
    border: 'border-clawd-border/30',
    label: 'Low',
  },
} as const;

/**
 * STATUS COLORS
 * Visual treatment for task statuses
 */
export const STATUS_COLORS = {
  todo: {
    text: 'text-info',
    bg: 'bg-info-subtle',
    border: 'border-l-blue-500',
    emoji: '📝',
  },
  'in-progress': {
    text: 'text-warning',
    bg: 'bg-warning-subtle',
    border: 'border-l-yellow-500',
    emoji: '⚡',
  },
  review: {
    text: 'text-review',
    bg: 'bg-review-subtle',
    border: 'border-l-purple-500',
    emoji: '🤖',
  },
  'human-review': {
    text: 'text-warning',
    bg: 'bg-warning-subtle',
    border: 'border-l-orange-500',
    emoji: '👤',
  },
  done: {
    text: 'text-success',
    bg: 'bg-success-subtle',
    border: 'border-l-green-500',
    emoji: '✅',
  },
  failed: {
    text: 'text-error',
    bg: 'bg-error-subtle',
    border: 'border-l-red-500',
    emoji: '❌',
  },
} as const;

/**
 * HELPER FUNCTIONS
 */

/**
 * Get spacing class string from spacing size
 */
export function getSpacingClass(size: SpacingSize, type: 'gap' | 'p' | 'm' = 'gap'): string {
  return `${type}-${SPACING[size]}`;
}

/**
 * Get card padding class string
 */
export function getCardPadding(size: keyof typeof CARD_PADDING = 'md'): string {
  return `p-${CARD_PADDING[size]}`;
}

/**
 * Get transition classes
 */
export function getTransition(duration: keyof typeof DURATION = 'normal', easing: keyof typeof EASING = 'out'): string {
  return `transition-all duration-${DURATION[duration]} ${EASING[easing]}`;
}

/**
 * Combine classes with proper spacing
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
