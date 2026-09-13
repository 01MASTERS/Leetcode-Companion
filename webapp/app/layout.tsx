import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import Providers from '@/components/Providers';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import ToastContainer from '@/components/ToastContainer';
import GlobalModals from '@/components/GlobalModals';
import { Agentation } from "agentation";
import Script from 'next/script';
import { Suspense } from 'react';
import GoogleAnalyticsTracker from '@/components/GoogleAnalyticsTracker';
import { GA_MEASUREMENT_ID } from '@/lib/analytics';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'LC Company Tracker',
  description: 'Track and solve LeetCode company-wise interview questions efficiently.',
  icons: {
    icon: [
      { url: '/logo.png', type: 'image/png' },
      { url: '/favicon.ico', type: 'image/x-icon' },
    ],
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full bg-background text-foreground select-none transition-colors duration-200">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans flex h-screen overflow-hidden`}>
        <Providers>
          {/* Sidebar */}
          <Sidebar />

          {/* Main workspace */}
          <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-background">
            {/* Topbar */}
            <Navbar />

            {/* Scrollable content canvas */}
            <main className="flex-1 overflow-y-auto overflow-x-hidden bg-gradient-to-b from-background via-background to-background/90">
              {children}
            </main>
          </div>

          {/* Global Modals & Toasts */}
          <GlobalModals />
          <ToastContainer />

          {/* SPA Route & User Session Analytics Tracker */}
          {GA_MEASUREMENT_ID && (
            <Suspense fallback={null}>
              <GoogleAnalyticsTracker />
            </Suspense>
          )}
        </Providers>

        {/* Google Analytics 4 (Only active when NEXT_PUBLIC_GA_ID is provided) */}
        {GA_MEASUREMENT_ID && (
          <>
            <Script
              strategy="afterInteractive"
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
            />
            <Script
              id="google-analytics"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${GA_MEASUREMENT_ID}');
                `,
              }}
            />
          </>
        )}

        {process.env.NODE_ENV === "development" && <Agentation />}
      </body>
    </html>
  );
}
