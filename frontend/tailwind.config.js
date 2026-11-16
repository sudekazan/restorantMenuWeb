/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      colors: {
        // Anlamsal renkler: değerleri src/index.css içindeki :root değişkenlerinden gelir.
        app: 'rgb(var(--c-app) / <alpha-value>)', // sayfa zemini
        card: 'rgb(var(--c-card) / <alpha-value>)', // kart, pencere, çubuk yüzeyi
        muted: 'rgb(var(--c-muted) / <alpha-value>)', // ikincil yüzey (rozet, pasif buton, girdi zemini)
        line: 'rgb(var(--c-line) / <alpha-value>)', // kenarlık ve ayırıcı
        ink: {
          DEFAULT: 'rgb(var(--c-ink) / <alpha-value>)', // ana metin
          soft: 'rgb(var(--c-ink-soft) / <alpha-value>)', // ikincil metin
          faint: 'rgb(var(--c-ink-faint) / <alpha-value>)', // soluk metin, ipucu
        },
        brand: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
        },
      },
    },
  },
  plugins: [],
};
