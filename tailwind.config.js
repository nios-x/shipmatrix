const { platformSelect, hairlineWidth } = require('nativewind/theme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.{js,ts,tsx}',
    './src/**/*.{js,ts,tsx}',
    './components/**/*.{js,ts,tsx}',
  ],
  darkMode: 'class',
  presets: [require('nativewind/preset')],
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
      fontFamily: {
        sans: [
          platformSelect({
            ios: 'Geist-Regular',
            android: 'Geist-Regular',
            default: 'Geist, sans-serif',
          }),
        ],
        geist: [
          platformSelect({
            ios: 'Geist-Regular',
            android: 'Geist-Regular',
            default: 'Geist, sans-serif',
          }),
        ],
        'geist-regular': [
          platformSelect({
            ios: 'Geist-Regular',
            android: 'Geist-Regular',
            default: 'Geist, sans-serif',
          }),
        ],
        'geist-medium': [
          platformSelect({
            ios: 'Geist-Medium',
            android: 'Geist-Medium',
            default: 'Geist, sans-serif',
          }),
        ],
        'geist-semibold': [
          platformSelect({
            ios: 'Geist-SemiBold',
            android: 'Geist-SemiBold',
            default: 'Geist, sans-serif',
          }),
        ],
        'geist-bold': [
          platformSelect({
            ios: 'Geist-Bold',
            android: 'Geist-Bold',
            default: 'Geist, sans-serif',
          }),
        ],
        'geist-black': [
          platformSelect({
            ios: 'Geist-Black',
            android: 'Geist-Black',
            default: 'Geist, sans-serif',
          }),
        ],
        'geist-light': [
          platformSelect({
            ios: 'Geist-Light',
            android: 'Geist-Light',
            default: 'Geist, sans-serif',
          }),
        ],
        'geist-thin': [
          platformSelect({
            ios: 'Geist-Thin',
            android: 'Geist-Thin',
            default: 'Geist, sans-serif',
          }),
        ],
        regular: [
          platformSelect({
            ios: 'Geist-Regular',
            android: 'Geist-Regular',
            default: 'Geist, sans-serif',
          }),
        ],
        medium: [
          platformSelect({
            ios: 'Geist-Medium',
            android: 'Geist-Medium',
            default: 'Geist, sans-serif',
          }),
        ],
        semibold: [
          platformSelect({
            ios: 'Geist-SemiBold',
            android: 'Geist-SemiBold',
            default: 'Geist, sans-serif',
          }),
        ],
        bold: [
          platformSelect({
            ios: 'Geist-Bold',
            android: 'Geist-Bold',
            default: 'Geist, sans-serif',
          }),
        ],
        black: [
          platformSelect({
            ios: 'Geist-Black',
            android: 'Geist-Black',
            default: 'Geist, sans-serif',
          }),
        ],
        light: [
          platformSelect({
            ios: 'Geist-Light',
            android: 'Geist-Light',
            default: 'Geist, sans-serif',
          }),
        ],
        thin: [
          platformSelect({
            ios: 'Geist-Thin',
            android: 'Geist-Thin',
            default: 'Geist, sans-serif',
          }),
        ],
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
