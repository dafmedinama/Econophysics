import type { Metadata } from 'next';
import { IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const instrument = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-instrument',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://econophysics-laboratory.dafmedinama.chatgpt.site'),
  title: 'Money as a Statistical System — dafmedinama/',
  description: 'An interactive and reproducible study of the statistical mechanics of money.',
  openGraph: {
    title: 'Money as a Statistical System — dafmedinama/',
    description: 'Four exchange mechanisms, 400 independent runs and four billion pairwise interactions.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Econophysics Laboratory' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Money as a Statistical System — dafmedinama/',
    description: 'Four exchange mechanisms, 400 independent runs and four billion pairwise interactions.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={instrument.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
