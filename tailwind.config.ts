import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        risk: { low: '#16a34a', moderate: '#ca8a04', high: '#ea580c', critical: '#dc2626' },
      },
    },
  },
  plugins: [],
} satisfies Config;
