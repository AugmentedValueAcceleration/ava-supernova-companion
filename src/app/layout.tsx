import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ava Companion',
  description: 'Your AI partner, everywhere you go.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Ava',
  },
};

export const viewport: Viewport = {
  themeColor: '#0D0D0F',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="bg-ava-bg text-gray-200 h-dvh overflow-hidden">
        {children}
      </body>
    </html>
  );
}
