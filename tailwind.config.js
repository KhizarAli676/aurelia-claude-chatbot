/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        obsidian: {
          950: '#070709',
          900: '#0D0D11',
          800: '#14141A',
          700: '#1D1D26',
        },
        champagne: {
          300: '#F0DEC0',
          400: '#DFC08A',
          500: '#C5A059',
          600: '#9E7B38',
        },
      },
    },
  },
  plugins: [],
};
