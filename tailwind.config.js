const { platformSelect, hairlineWidth } = require('nativewind/theme');

/** One Raleway face: the expo-google-fonts name on native, the web font elsewhere. */
const raleway = (face) => [
  platformSelect({
    ios: `Raleway_${face}`,
    android: `Raleway_${face}`,
    default: 'Raleway, sans-serif',
  }),
];

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.{js,ts,tsx}', './src/**/*.{js,ts,tsx}', './components/**/*.{js,ts,tsx}'],
  darkMode: 'class',
  presets: [require('nativewind/preset')],
  corePlugins: {
    fontWeight: false,
  },
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        purple: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
        },
        brand: {
          blue: '#1E40AF',
          teal: '#0D9488',
          purple: '#7c3aed',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      borderWidth: {
        hairline: hairlineWidth(),
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
      // Raleway ships one file per weight, so a weight is a family name. Every
      // weight utility (font-semibold, font-bold, …) maps to its own face, and
      // the fontWeight core plugin is off (see corePlugins): a custom family with
      // fontWeight >= 700 makes Android look for a bold style the font does not
      // register, and it falls back to Roboto. Web keeps real weights through
      // global.css, where every family resolves to the Raleway web font.
      fontFamily: {
        sans: raleway('400Regular'),
        mono: [
          platformSelect({
            ios: 'Menlo',
            android: 'monospace',
            default: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          }),
        ],
        thin: raleway('100Thin'),
        extralight: raleway('200ExtraLight'),
        light: raleway('300Light'),
        regular: raleway('400Regular'),
        medium: raleway('500Medium'),
        semibold: raleway('600SemiBold'),
        bold: raleway('700Bold'),
        extrabold: raleway('800ExtraBold'),
        black: raleway('900Black'),
        raleway: raleway('400Regular'),
        'raleway-thin': raleway('100Thin'),
        'raleway-light': raleway('300Light'),
        'raleway-regular': raleway('400Regular'),
        'raleway-medium': raleway('500Medium'),
        'raleway-semibold': raleway('600SemiBold'),
        'raleway-bold': raleway('700Bold'),
        'raleway-extrabold': raleway('800ExtraBold'),
        'raleway-black': raleway('900Black'),
        // Legacy aliases from when the app shipped Geist.
        geist: raleway('400Regular'),
        'geist-thin': raleway('100Thin'),
        'geist-light': raleway('300Light'),
        'geist-regular': raleway('400Regular'),
        'geist-medium': raleway('500Medium'),
        'geist-semibold': raleway('600SemiBold'),
        'geist-bold': raleway('700Bold'),
        'geist-black': raleway('900Black'),
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
