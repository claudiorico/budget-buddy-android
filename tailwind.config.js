/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#2563EB',
        danger: '#EF4444',
        warning: '#F59E0B',
        success: '#10B981',
      },
    },
  },
  plugins: [],
};
