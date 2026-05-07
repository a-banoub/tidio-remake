export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: { DEFAULT: '#1B2B4B', 700: '#243760', 900: '#0F1A30' },
          emerald: { DEFAULT: '#2E7D52', 600: '#266b46', 50: '#eaf5ee' },
          gold: { DEFAULT: '#C9A961', 50: '#f7f1e2' },
          gray: '#F4F3F0',
        }
      },
      fontFamily: {
        display: ['"Playfair Display"', 'serif'],
        sans: ['"DM Sans"', 'sans-serif'],
        mono: ['"SF Mono"', 'monospace'],
      },
    },
  },
};
