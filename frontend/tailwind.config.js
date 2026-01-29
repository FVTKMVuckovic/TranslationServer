/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // FVTK Corporate Colors - brighter for better contrast
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',  // Bright blue for buttons
          500: '#3b82f6',  // Main button color - vibrant blue
          600: '#2563eb',  // Hover state
          700: '#1d4ed8',  // Active state
          800: '#1e40af',
          900: '#1e3a8a',
        },
        // Accent blue for highlights
        accent: {
          300: '#7dd3fc',
          400: '#38bdf8',  // Bright sky blue
          500: '#0ea5e9',
          600: '#0284c7',
        },
        // Dark backgrounds (FVTK corporate)
        fvtk: {
          dark: '#1e3a5f',      // Corporate dark blue
          darker: '#0d2137',    // Header dark
          accent: '#38bdf8',    // Highlight blue (brighter)
          light: '#f8fafc',     // Light backgrounds
        },
      },
    },
  },
  plugins: [],
}
