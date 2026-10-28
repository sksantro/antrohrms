/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'ui-sans-serif', 'sans-serif'],
      },
      colors: {
        ink: {
          50: '#f6f7fb', 100: '#eceef5', 200: '#d6dae7', 300: '#b3bad0', 400: '#8891ad',
          500: '#646e8d', 600: '#4b5472', 700: '#363e5a', 800: '#1f2640', 900: '#121830', 950: '#0a0e1f',
        },
        brand: {
          50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc', 400: '#7b8cff',
          500: '#4f5dff', 600: '#3a46f0', 700: '#2f37d0', 800: '#2a2fa8', 900: '#262b85',
        },
        canvas: '#f5f7fc',
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,48,.04), 0 1px 3px rgba(16,24,48,.06)',
        lift: '0 8px 24px -8px rgba(16,24,48,.14), 0 2px 6px rgba(16,24,48,.05)',
        glow: '0 10px 30px -10px rgba(58,70,240,.55)',
      },
      borderRadius: { xl: '14px', '2xl': '18px', '3xl': '24px' },
      keyframes: {
        'fade-up': { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'none' } },
        'slide-in': { from: { transform: 'translateX(100%)' }, to: { transform: 'none' } },
        'slide-in-left': { from: { transform: 'translateX(-100%)' }, to: { transform: 'none' } },
        pulse2: { '0%,100%': { opacity: 1 }, '50%': { opacity: .45 } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-4px)' } },
      },
      animation: {
        'fade-up': 'fade-up .35s ease-out both',
        'slide-in': 'slide-in .28s cubic-bezier(.2,.8,.2,1) both',
        'slide-in-left': 'slide-in-left .28s cubic-bezier(.2,.8,.2,1) both',
        pulse2: 'pulse2 1.8s ease-in-out infinite',
        float: 'float 5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
