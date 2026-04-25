/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['"Instrument Serif"', 'serif'],
        sans: ['"Inter Tight"', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: {
          50: '#f6f5f1',
          100: '#ebe8df',
          200: '#d6d1c2',
          900: '#161513',
          950: '#0c0b0a',
        },
        accent: {
          income: '#3d8b5f',
          expense: '#c2452f',
        },
      },
    },
  },
  plugins: [],
};
