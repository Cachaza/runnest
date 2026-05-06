/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      fontFamily: {
        display: 'SpaceGrotesk_700Bold',
        'display-medium': 'SpaceGrotesk_600SemiBold',
      },
      borderRadius: {
        card: 16,
        hero: 18,
      },
      colors: {
        background: 'rgb(var(--color-background) / <alpha-value>)',
        'accent-border': 'rgb(var(--color-accent-border) / <alpha-value>)',
        'badge-cool': 'rgb(var(--color-badge-cool) / <alpha-value>)',
        'badge-neutral': 'rgb(var(--color-badge-neutral) / <alpha-value>)',
        'badge-warm': 'rgb(var(--color-badge-warm) / <alpha-value>)',
        border: 'rgb(var(--color-border) / <alpha-value>)',
        chip: 'rgb(var(--color-chip) / <alpha-value>)',
        danger: 'rgb(var(--color-danger) / <alpha-value>)',
        'danger-surface': 'rgb(var(--color-danger-surface) / <alpha-value>)',
        'elevated-surface': 'rgb(var(--color-elevated-surface) / <alpha-value>)',
        hero: 'rgb(var(--color-hero) / <alpha-value>)',
        'hero-accent': 'rgb(var(--color-hero-accent) / <alpha-value>)',
        'hero-overlay': 'rgb(var(--color-hero-overlay) / <alpha-value>)',
        'hero-text': 'rgb(var(--color-hero-text) / <alpha-value>)',
        'hero-text-muted': 'rgb(var(--color-hero-text-muted) / <alpha-value>)',
        'input-bg': 'rgb(var(--color-input-bg) / <alpha-value>)',
        'muted-text': 'rgb(var(--color-muted-text) / <alpha-value>)',
        'on-accent': 'rgb(var(--color-on-accent) / <alpha-value>)',
        'on-tint': 'rgb(var(--color-on-tint) / <alpha-value>)',
        shadow: 'rgb(var(--color-shadow) / <alpha-value>)',
        success: 'rgb(var(--color-success) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        text: 'rgb(var(--color-text) / <alpha-value>)',
        tint: 'rgb(var(--color-tint) / <alpha-value>)',
      },
    },
  },
};
