/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        /**
         * Both scales are sampled from the OLAD crest so the interface and the
         * logo belong together: the laurel blue (#6084e4) and the scales'
         * forest green (#305418 – #487824).
         *
         * `navy` and `brass` are kept as ALIASES of these two. Hundreds of
         * elements already reference them, and remapping the values retunes
         * the whole interface at once instead of rewriting every class name —
         * far less risk of missing one and leaving a stray old colour behind.
         */
        blue: {
          50: '#EEF3FD',
          100: '#DDE7FB',
          200: '#C2D3F7',
          300: '#9DB6F1',
          400: '#7A99EA',
          500: '#6084E4',
          600: '#4566D4',
          700: '#3A53B8',
          800: '#2F4494',
          900: '#293B77',
          950: '#1B2650',
        },
        green: {
          50: '#F3F8EF',
          100: '#E4F0DA',
          200: '#C9E1B7',
          300: '#A2CB88',
          400: '#78B057',
          500: '#559034',
          600: '#487824',
          700: '#3B611F',
          800: '#305418',
          900: '#284515',
          950: '#16280C',
        },
        // Primary interface colour — the blue from the crest.
        navy: {
          50: '#EEF3FD',
          100: '#DDE7FB',
          200: '#C2D3F7',
          300: '#9DB6F1',
          400: '#7A99EA',
          500: '#6084E4',
          600: '#4566D4',
          700: '#3A53B8',
          800: '#2F4494',
          900: '#293B77',
          950: '#1B2650',
        },
        // Accent — the green from the crest, replacing the old brass.
        brass: {
          50: '#F3F8EF',
          100: '#E4F0DA',
          200: '#C9E1B7',
          300: '#A2CB88',
          400: '#78B057',
          500: '#559034',
          600: '#487824',
          700: '#3B611F',
          800: '#305418',
          900: '#284515',
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
        // Public Sans — the same face the Ministry's own notary portal uses.
        sans: ['"Public Sans Variable"', '"Public Sans"', 'Segoe UI', 'system-ui', 'sans-serif'],
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
