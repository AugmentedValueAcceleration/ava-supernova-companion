import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ava Companion',
  description: 'Your AI partner, everywhere you go.',
};

export const viewport: Viewport = {
  themeColor: '#0D0D0F',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-ava-bg text-gray-200 h-dvh overflow-hidden">
        {children}
      </body>
    </html>
  );
}
