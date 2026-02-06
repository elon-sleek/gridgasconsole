/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
    './src/app/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        primary: '#2563EB',
        surface: '#FFFFFF',
        surfaceMuted: '#F8FAFC',
        border: '#E2E8F0',
        textPrimary: '#0F172A',
        textSecondary: '#475569',
        dark: {
          surface: '#0F172A',
          surfaceMuted: '#111827',
          border: '#1F2937',
          textPrimary: '#E5E7EB',
          textSecondary: '#9CA3AF'
        }
      },
      borderRadius: {
        card: '10px',
        control: '6px'
      },
      boxShadow: {
        card: '0 6px 24px rgba(15, 23, 42, 0.08)'
      }
    }
  },
  plugins: []
};
