/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'clawd': {
          bg: 'var(--clawd-bg, #0f0f0f)',
          surface: 'var(--clawd-surface, #1a1a1a)',
          border: 'var(--clawd-border, #2a2a2a)',
          accent: 'var(--clawd-accent, #22c55e)',
          'accent-dim': 'var(--clawd-accent-dim, #16a34a)',
          text: 'var(--clawd-text, #fafafa)',
          'text-dim': 'var(--clawd-text-dim, #a3a3a3)',
        }
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
  plugins: [],
}
