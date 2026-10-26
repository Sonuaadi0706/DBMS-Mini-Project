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

// Runs before the page paints, so there is never a flash of the wrong theme. Dark is the default.
const THEME_SCRIPT = `try{var t=localStorage.getItem('pp-theme')||'dark';if(t==='system')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';var d=document.documentElement;d.classList.remove('dark','light');d.classList.add(t==='light'?'light':'dark')}catch(e){}`;

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
