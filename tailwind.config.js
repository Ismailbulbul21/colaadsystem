/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Deep authoritative navy — the legal-office anchor colour.
        navy: {
          50: '#F2F6FC',
          100: '#E3EBF7',
          200: '#C6D6EE',
          300: '#9AB6DF',
          400: '#6690CB',
          500: '#4270B3',
          600: '#2F5697',
          700: '#26437A',
          800: '#1B3260',
          900: '#0F2444',
          950: '#08172E',
        },
        // Restrained brass accent. Used sparingly — active markers, seals,
        // the odd highlight. Enough to read as considered, never decorative.
        brass: {
          50: '#FBF8EF',
          100: '#F5EDD6',
          200: '#EAD9A9',
          300: '#DCC074',
          400: '#CFA84B',
          500: '#BE9036',
          600: '#A2732B',
          700: '#815726',
          800: '#6C4825',
          900: '#5C3D23',
        },
        // Cooled neutrals, variable-driven so the scale inverts in dark mode.
        ink: {
          50: 'rgb(var(--ink-50) / <alpha-value>)',
          100: 'rgb(var(--ink-100) / <alpha-value>)',
          200: 'rgb(var(--ink-200) / <alpha-value>)',
          300: 'rgb(var(--ink-300) / <alpha-value>)',
          400: 'rgb(var(--ink-400) / <alpha-value>)',
          500: 'rgb(var(--ink-500) / <alpha-value>)',
          600: 'rgb(var(--ink-600) / <alpha-value>)',
          700: 'rgb(var(--ink-700) / <alpha-value>)',
          800: 'rgb(var(--ink-800) / <alpha-value>)',
          900: 'rgb(var(--ink-900) / <alpha-value>)',
        },
        // Driven by CSS variables so a single `.dark` class on <html> re-skins
        // every surface at once, instead of tagging hundreds of components.
        surface: {
          DEFAULT: 'rgb(var(--surface) / <alpha-value>)',
          muted: 'rgb(var(--surface-muted) / <alpha-value>)',
          sunken: 'rgb(var(--surface-sunken) / <alpha-value>)',
          border: 'rgb(var(--surface-border) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['InterVariable', 'Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.01em' }],
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '1rem',
      },
      boxShadow: {
        // Layered and soft — depth without the muddy grey of a single blur.
        xs: '0 1px 2px 0 rgb(15 36 68 / 0.04)',
        card: '0 1px 2px 0 rgb(15 36 68 / 0.04), 0 1px 3px 0 rgb(15 36 68 / 0.06)',
        'card-hover':
          '0 2px 4px -1px rgb(15 36 68 / 0.06), 0 8px 16px -4px rgb(15 36 68 / 0.10)',
        panel:
          '0 4px 6px -2px rgb(15 36 68 / 0.06), 0 24px 48px -12px rgb(15 36 68 / 0.22)',
        inset: 'inset 0 1px 2px 0 rgb(15 36 68 / 0.05)',
        ring: '0 0 0 1px rgb(15 36 68 / 0.06)',
      },
      keyframes: {
        'fade-in': { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        'slide-up': {
          '0%': { opacity: 0, transform: 'translateY(8px) scale(0.99)' },
          '100%': { opacity: 1, transform: 'translateY(0) scale(1)' },
        },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'fade-in': 'fade-in .16s ease-out',
        'slide-up': 'slide-up .2s cubic-bezier(0.16, 1, 0.3, 1)',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
}
