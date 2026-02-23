import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{ts,tsx}',
    './public/**/*.html',
  ],
  theme: {
    extend: {
      colors: {
        rose: {
          DEFAULT: '#FF2D78',
          light: '#FF5C96',
          dark: '#CC2460',
        },
        surface: {
          base: '#000000',
          card: '#08080C',
          elevated: '#0F0F15',
          hover: '#16161F',
        },
        text: {
          heading: '#FFFFFF',
          body: '#A0A0B0',
          muted: '#686878',
          disabled: '#404050',
        },
        success: '#34D399',
        error: '#F87171',
      },
      fontFamily: {
        display: ['Sora', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderColor: {
        subtle: 'rgba(255,255,255,0.06)',
        medium: 'rgba(255,255,255,0.1)',
      },
      boxShadow: {
        glow: '0 0 24px rgba(255,45,120,0.15)',
        'glow-lg': '0 0 40px rgba(255,45,120,0.25)',
      },
    },
  },
  plugins: [],
};

export default config;
