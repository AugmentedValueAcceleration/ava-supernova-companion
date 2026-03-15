import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ava: {
          bg: '#0D0D0F',
          surface: '#1A1A2E',
          'surface-hover': '#222238',
          border: '#2A2A3E',
          purple: '#A855F7',
          'purple-light': '#C084FC',
          'purple-dark': '#7C3AED',
        },
      },
    },
  },
  plugins: [],
};

export default config;
