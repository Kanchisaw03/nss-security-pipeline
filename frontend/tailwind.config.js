/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Cyber Governance Theme
        'bg-primary': '#0A0F1C',
        'bg-panel': '#121A2B',
        'border-panel': '#1F2A44',
        'accent-primary': '#00D1FF',
        'risk-warning': '#FF4D4D',
        'privacy-safe': '#00FFAA',
        'sensitive': '#B388FF',
        // Extended palette
        'cyber-blue': {
          50: '#E6FAFF',
          100: '#B3F0FF',
          200: '#80E5FF',
          300: '#4DDBFF',
          400: '#1AD0FF',
          500: '#00D1FF',
          600: '#00A7CC',
          700: '#007D99',
          800: '#005366',
          900: '#002A33',
        },
        'cyber-dark': {
          50: '#F0F4F8',
          100: '#D9E2EC',
          200: '#BCCCDC',
          300: '#9FB3C8',
          400: '#829AB1',
          500: '#627D98',
          600: '#486581',
          700: '#334E68',
          800: '#243B53',
          900: '#102A43',
          950: '#0A0F1C',
        },
        'cyber-red': {
          400: '#FF8080',
          500: '#FF4D4D',
          600: '#CC3D3D',
        },
        'cyber-green': {
          400: '#80FFCC',
          500: '#00FFAA',
          600: '#00CC88',
        },
        'cyber-purple': {
          400: '#D4B3FF',
          500: '#B388FF',
          600: '#8F6CCC',
        },
      },
      fontFamily: {
        'display': ['Inter', 'Space Grotesk', 'system-ui', 'sans-serif'],
        'mono': ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': '0.625rem',
        '3xs': '0.5rem',
      },
      borderWidth: {
        'thin': '1px',
      },
      boxShadow: {
        'glow-primary': '0 0 20px rgba(0, 209, 255, 0.3)',
        'glow-risk': '0 0 20px rgba(255, 77, 77, 0.3)',
        'glow-safe': '0 0 20px rgba(0, 255, 170, 0.3)',
        'glow-purple': '0 0 20px rgba(179, 136, 255, 0.3)',
      },
      backgroundImage: {
        'grid-pattern': "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%231F2A44' fill-opacity='0.4' fill-rule='evenodd'%3E%3Cpath d='M0 40L40 0H20L0 20M40 40V20L20 40'/%3E%3C/g%3E%3C/svg%3E\")",
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(0, 209, 255, 0.2)' },
          '100%': { boxShadow: '0 0 20px rgba(0, 209, 255, 0.4)' },
        },
      },
    },
  },
  plugins: [],
}