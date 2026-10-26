import type { Config } from 'tailwindcss';

// Every colour is a CSS variable (src/app/theme.css) so the same class names work in light and dark mode.
const scale = (name: string) =>
  Object.fromEntries([50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((s) => [s, `rgb(var(--c-${name}-${s}) / <alpha-value>)`]));

export default {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        slate: scale('slate'), green: scale('green'), red: scale('red'), amber: scale('amber'), yellow: scale('yellow'),
        orange: scale('orange'), blue: scale('blue'), emerald: scale('emerald'),
        indigo: scale('brand'),            // legacy class name: the old "indigo" is now the pulse-teal brand colour
        brand: scale('brand'),
        white: 'rgb(var(--c-surface) / <alpha-value>)', shine: 'rgb(255 255 255 / <alpha-value>)', surface: 'rgb(var(--c-surface) / <alpha-value>)', appbg: 'rgb(var(--c-app) / <alpha-value>)', onbrand: 'rgb(var(--c-onbrand) / <alpha-value>)',
        risk: { low: '#34d399', moderate: '#fbbf24', high: '#fb923c', critical: '#f43f5e' },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 0 0 rgb(255 255 255 / 0.04) inset, 0 12px 32px -16px rgb(0 0 0 / 0.45)',
        glow: '0 10px 30px -10px rgb(var(--c-glow) / 0.65)',
        lift: '0 18px 40px -18px rgb(0 0 0 / 0.55), 0 0 0 1px rgb(var(--c-glow) / 0.18)',
      },
      keyframes: {
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(14px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'scale-in': { '0%': { opacity: '0', transform: 'scale(.96)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        'slide-in': { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'translateX(0)' } },
        shimmer: { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'translateX(100%)' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        'pulse-ring': { '0%': { transform: 'scale(.8)', opacity: '.7' }, '100%': { transform: 'scale(2.2)', opacity: '0' } },
        shake: { '0%,100%': { transform: 'translateX(0)' }, '20%,60%': { transform: 'translateX(-6px)' }, '40%,80%': { transform: 'translateX(6px)' } },
        grow: { '0%': { transform: 'scaleX(0)' }, '100%': { transform: 'scaleX(1)' } },
        ecg: { '0%': { transform: 'translateX(0)' }, '100%': { transform: 'translateX(-50%)' } },
        aurora: { '0%,100%': { transform: 'translate3d(0,0,0) scale(1)' }, '50%': { transform: 'translate3d(3%,-4%,0) scale(1.1)' } },
        draw: { '0%': { strokeDashoffset: '1' }, '100%': { strokeDashoffset: '0' } },
      },
      animation: {
        'fade-up': 'fade-up .6s cubic-bezier(.2,.8,.2,1) both', 'fade-in': 'fade-in .5s ease both', 'scale-in': 'scale-in .35s cubic-bezier(.2,.8,.2,1) both',
        'slide-in': 'slide-in .3s cubic-bezier(.2,.8,.2,1) both', shimmer: 'shimmer 1.8s infinite', float: 'float 7s ease-in-out infinite',
        'pulse-ring': 'pulse-ring 2.4s cubic-bezier(.2,.6,.4,1) infinite', shake: 'shake .45s ease', grow: 'grow .9s cubic-bezier(.2,.8,.2,1) both',
        aurora: 'aurora 18s ease-in-out infinite', draw: 'draw 2.4s ease-out both',
      },
    },
  },
  plugins: [],
} satisfies Config;
