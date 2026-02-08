/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './frontend/index.html',
    './frontend/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#0A0F1C',
        'bg-panel': '#111827',
        'border-panel': '#1F2A44',
        'accent-primary': '#00D1FF',
        'privacy-safe': '#00FFAA',
        'risk-warning': '#FF4D4D',
      },
      fontFamily: {
        display: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}

