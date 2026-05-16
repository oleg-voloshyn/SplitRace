/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: {
          red: '#e53935',
          navy: '#1a1a2e'
        },
        status: {
          'draft-bg': '#fff3cd',
          'draft-fg': '#856404',
          'pending-bg': '#cce5ff',
          'pending-fg': '#004085',
          'active-bg': '#d4edda',
          'active-fg': '#155724',
          'rejected-bg': '#f8d7da',
          'rejected-fg': '#721c24',
          'completed-bg': '#e2e3e5',
          'completed-fg': '#383d41'
        }
      }
    }
  },
  plugins: []
};
