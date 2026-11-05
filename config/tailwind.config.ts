import type { Config } from 'tailwindcss';

// Giữ nhận diện navy của legacy/style.css:3-31, tinh chỉnh thang chữ, bóng đổ, chuyển động.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    screens: { sm: '600px', md: '861px', lg: '1100px', xl: '1440px' }, // md = sidebar dọc (legacy: >860px)
    extend: {
      fontFamily: { sans: ['"Be Vietnam Pro"', 'system-ui', '"Segoe UI"', 'Arial', 'sans-serif'] },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.04em' }],
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.8125rem', { lineHeight: '1.25rem' }],
        base: ['0.875rem', { lineHeight: '1.375rem' }],
        md: ['0.9375rem', { lineHeight: '1.375rem' }],
        lg: ['1.0625rem', { lineHeight: '1.625rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem', letterSpacing: '-0.01em' }],
        '2xl': ['1.5rem', { lineHeight: '1.875rem', letterSpacing: '-0.015em' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem', letterSpacing: '-0.02em' }],
        display: ['2.5rem', { lineHeight: '2.75rem', letterSpacing: '-0.03em' }],
      },
      colors: {
        navy: {
          950: '#0a1f38', 900: '#0f2a4a', 800: '#15365f', 700: '#1e3a5f', 600: '#2b4c7a',
          300: '#8ea3c2', 200: '#b8c7dc', 100: '#cbd5e1',
        },
        bg: '#f4f6f9',
        surface: { DEFAULT: '#ffffff', 2: '#f8fafc' },
        line: { DEFAULT: '#e2e8f0', 2: '#cbd5e1' },
        ink: { DEFAULT: '#0f172a', 2: '#334155' },
        muted: '#64748b',
        accent: { DEFAULT: '#2563eb', soft: '#eff4ff', ink: '#1d4ed8', line: '#bfd3fe', light: '#60a5fa' },
        pill: { DEFAULT: '#eef2ff', text: '#3730a3' },
        warn: { bg: '#fffbeb', line: '#fde68a', text: '#92400e', cell: '#b45309' },
        // trạng thái: nền nhạt + chữ đậm (chip), màu đặc "fill" (biểu đồ). Đồng bộ với CAT_FILL trong src/lib/status.ts
        done: { bg: '#e7f6ec', text: '#15803d', fill: '#4caf6e' },
        doing: { bg: '#fef6e0', text: '#a16207', fill: '#e9b02b' },
        late: { bg: '#fdecea', text: '#b42318', fill: '#d9483b', soft: '#fff7f6', line: '#f7d4cf' },
        todo: { bg: '#f1edfb', text: '#6d4fc2', fill: '#9b86d6' },
      },
      borderRadius: { sm: '6px', md: '8px', lg: '10px', xl: '14px', '2xl': '18px' },
      boxShadow: {
        card: '0 1px 2px rgba(15,23,42,.05), 0 1px 3px rgba(15,23,42,.06)',
        'card-hover': '0 8px 20px -8px rgba(15,23,42,.18), 0 2px 4px rgba(15,23,42,.05)',
        pop: '0 12px 32px rgba(15,23,42,.18)',
        focus: '0 0 0 3px rgba(37,99,235,.18)',
      },
      transitionDuration: { fast: '150ms', base: '250ms', slow: '600ms' },
      transitionTimingFunction: { out: 'cubic-bezier(.2,.8,.2,1)' },
      keyframes: {
        'fade-in': { from: { opacity: '0' } },
        'slide-in': { from: { transform: 'translateX(40px)', opacity: '0' } },
        'rise-in': { from: { transform: 'translateY(8px)', opacity: '0' } },
        'pop-in': { from: { transform: 'scale(.97)', opacity: '0' } },
        shimmer: { to: { backgroundPosition: '-200% 0' } },
        'grow-x': { from: { clipPath: 'inset(0 100% 0 0)' }, to: { clipPath: 'inset(0 0 0 0)' } },
        'grow-y': { from: { clipPath: 'inset(100% 0 0 0)' }, to: { clipPath: 'inset(0 0 0 0)' } },
        spin: { to: { transform: 'rotate(360deg)' } },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'slide-in': 'slide-in 250ms cubic-bezier(.2,.8,.2,1)',
        'rise-in': 'rise-in 250ms cubic-bezier(.2,.8,.2,1) both',
        'pop-in': 'pop-in 150ms cubic-bezier(.2,.8,.2,1)',
        shimmer: 'shimmer 1.2s linear infinite',
        'grow-x': 'grow-x 600ms cubic-bezier(.2,.8,.2,1) both',
        'grow-y': 'grow-y 600ms cubic-bezier(.2,.8,.2,1) both',
        spin: 'spin .7s linear infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
