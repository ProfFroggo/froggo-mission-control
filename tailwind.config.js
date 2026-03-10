// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      maxWidth: {
        '8xl': '90rem',
        '12xl': '120rem',
      },
      borderColor: {
        DEFAULT: 'var(--mission-control-border, #2a2a2a)',
      },
      colors: {
        'mission-control': {
          bg: 'var(--mission-control-bg, #0a0a0a)',
          surface: 'var(--mission-control-surface, #141414)',
          border: 'var(--mission-control-border, #2a2a2a)', /* Pure neutral gray */
          accent: 'var(--mission-control-accent, #22c55e)',
          'accent-dim': 'var(--mission-control-accent-dim, #16a34a)',
          text: 'var(--mission-control-text, #fafafa)',
          'text-dim': 'var(--mission-control-text-dim, #a1a1aa)',
          'bg-alt': 'var(--mission-control-bg-alt, #1a1a1a)',
          'bg0': 'var(--mission-control-bg0, #0a0a0a)',
          'card': 'var(--mission-control-card, #141414)',
        },
        // ── Design Token Bridge ──────────────────────────────────
        // Maps CSS custom property tokens → Tailwind utilities.
        // Usage: text-success, bg-success-subtle, border-success, etc.
        // Source: src/design-tokens.css
        'success': {
          DEFAULT: 'var(--color-success, #22c55e)',
          subtle: 'var(--color-success-bg, rgba(34, 197, 94, 0.1))',
          border: 'var(--color-success-border, rgba(34, 197, 94, 0.3))',
          hover: 'var(--color-success-hover, #16a34a)',
        },
        'error': {
          DEFAULT: 'var(--color-error, #ef4444)',
          subtle: 'var(--color-error-bg, rgba(239, 68, 68, 0.1))',
          border: 'var(--color-error-border, rgba(239, 68, 68, 0.3))',
          hover: 'var(--color-error-hover, #dc2626)',
        },
        'warning': {
          DEFAULT: 'var(--color-warning, #f59e0b)',
          subtle: 'var(--color-warning-bg, rgba(245, 158, 11, 0.1))',
          border: 'var(--color-warning-border, rgba(245, 158, 11, 0.3))',
          hover: 'var(--color-warning-hover, #d97706)',
        },
        'info': {
          DEFAULT: 'var(--color-info, #3b82f6)',
          subtle: 'var(--color-info-bg, rgba(59, 130, 246, 0.1))',
          border: 'var(--color-info-border, rgba(59, 130, 246, 0.3))',
          hover: 'var(--color-info-hover, #2563eb)',
        },
        // Review/purple semantic color (not yet in tokens.css, defined here)
        'review': {
          DEFAULT: 'var(--color-review, #a855f7)',
          subtle: 'var(--color-review-bg, rgba(168, 85, 247, 0.1))',
          border: 'var(--color-review-border, rgba(168, 85, 247, 0.3))',
          hover: 'var(--color-review-hover, #9333ea)',
        },
        // Neutral/muted (for disabled states, inactive UI)
        'muted': {
          DEFAULT: 'var(--color-muted, #6b7280)',
          subtle: 'var(--color-muted-bg, rgba(107, 114, 128, 0.1))',
          border: 'var(--color-muted-border, rgba(107, 114, 128, 0.3))',
        },
        // Danger action (orange, for destructive-but-not-error actions)
        'danger': {
          DEFAULT: 'var(--color-danger, #f97316)',
          hover: 'var(--color-danger-hover, #ea580c)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
      boxShadow: {
        'card': '0 2px 8px rgba(0, 0, 0, 0.3)',
        'card-hover': '0 8px 24px rgba(0, 0, 0, 0.4)',
        'card-lg': '0 4px 16px rgba(0, 0, 0, 0.35)',
        'glow': '0 0 20px rgba(34, 197, 94, 0.3)',
        'glow-lg': '0 0 40px rgba(34, 197, 94, 0.4)',
      },
      animation: {
        'shimmer': 'shimmer 2s infinite',
      },
      keyframes: {
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
}
