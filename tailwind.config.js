/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#FDF0F9',
          100: '#FBDCEF',
          200: '#F7B5DE',
          300: '#F08DCC',
          400: '#D04090',
          500: '#A02070',
          600: '#800060',
          700: '#600048',
          800: '#400030',
          900: '#200018',
        },
        gold: {
          400: '#F0E010',
          500: '#D0A040',
          600: '#B08030',
        },
        cyan: {
          400: '#40C0F0',
          500: '#00A0F0',
          600: '#0080C0',
        },
        paper: '#F0F0F0',
      },
      fontFamily: {
        bn: ['"Hind Siliguri"', '"Noto Sans Bengali"', 'sans-serif'],
        en: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      fontSize: {
        'fluid-xs': 'clamp(0.7rem, 0.65rem + 0.25vw, 0.8rem)',
        'fluid-sm': 'clamp(0.8rem, 0.75rem + 0.3vw, 0.9rem)',
        'fluid-base': 'clamp(0.9rem, 0.85rem + 0.3vw, 1rem)',
        'fluid-lg': 'clamp(1rem, 0.9rem + 0.5vw, 1.2rem)',
        'fluid-xl': 'clamp(1.2rem, 1rem + 0.8vw, 1.6rem)',
        'fluid-2xl': 'clamp(1.5rem, 1.2rem + 1.2vw, 2.2rem)',
        'fluid-3xl': 'clamp(1.8rem, 1.4rem + 1.6vw, 3rem)',
      },
      screens: {
        'xs': '360px',
        '2xs': '240px',
        '3xs': '200px',
        '3xl': '1920px',
        '4xl': '2560px',
        '5xl': '3840px',
        '6xl': '6000px',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};
