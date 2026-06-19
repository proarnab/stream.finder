// app/layout.tsx
import type { Metadata, Viewport } from 'next';
import { Playfair_Display, DM_Sans, JetBrains_Mono } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { SessionProvider } from '@/components/auth/SessionProvider';
import { InstallBanner } from '@/components/pwa/InstallBanner';

const playfair = Playfair_Display({
  subsets: ['latin'], variable: '--font-display', display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});
const dmSans = DM_Sans({
  subsets: ['latin'], variable: '--font-body', display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'], variable: '--font-mono', display: 'swap',
  weight: ['400', '500'],
});

export const viewport: Viewport = {
  themeColor: '#f97316',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: {
    default: 'StreamFinder — Where to Watch Movies Online',
    template: '%s | StreamFinder',
  },
  description:
    'Find where to watch any movie legally online — free streaming, rentals & purchases across all major platforms. Powered by TMDb.',
  keywords: ['where to watch', 'streaming', 'movies online', 'free movies', 'watch legally'],
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://streamfinder.app'),
  openGraph: { type: 'website', siteName: 'StreamFinder', locale: 'en_US' },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large' } },
  alternates: { canonical: '/' },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'StreamFinder',
  },
  applicationName: 'StreamFinder',
  formatDetection: { telephone: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const adsenseId = process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID;

  return (
    <html lang="en" className={`${playfair.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
        {adsenseId && (
          <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseId}`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
        )}
      </head>
      <body className="bg-surface-950 text-white font-body antialiased">
        <SessionProvider>
          <Navbar />
          <main className="min-h-screen">{children}</main>
          <Footer />
          <InstallBanner />
        </SessionProvider>
      </body>
    </html>
  );
}
