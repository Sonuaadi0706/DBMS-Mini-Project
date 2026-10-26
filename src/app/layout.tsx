import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const sans = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'ProjectPulse', template: '%s · ProjectPulse' },
  description: 'Academic project governance, originality and milestone risk monitor',
};
export const viewport: Viewport = { themeColor: '#09090b', colorScheme: 'dark light' };

// Runs before the page paints, so there is never a flash of the wrong theme. The login page is always light; every other
// page uses the saved choice and defaults to dark.
const THEME_SCRIPT = `try{var t=location.pathname.indexOf('/login')===0?'light':(localStorage.getItem('pp-theme')||'dark');var d=document.documentElement;d.classList.remove('dark','light');d.classList.add(t==='light'?'light':'dark')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} /></head>
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
