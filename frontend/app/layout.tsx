import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, Outfit, DM_Sans } from 'next/font/google';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-marketing',
  display: 'swap',
});

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'CETLOE Debate AI',
  description: 'Voice-first debate practice for students.',
  icons: { icon: '/assets/ai-microphone.gif' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${plusJakarta.variable} ${outfit.variable} ${dmSans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
