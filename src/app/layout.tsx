import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import Navigation from "./ui/Navigation";
import Footer from "./ui/Footer";
import ClientLayout from "@/components/ClientLayout";
import ConsentManager from "@/components/consent/ConsentManager";
import { homeMetadata } from "./metadata";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://dcmgrading.com'),
  ...homeMetadata,
  // Default metadata that can be overridden by child pages
  title: {
    default: 'DCM Grading - AI-Powered Trading Card Grading',
    template: '%s | DCM Grading',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: pre-hydration scripts and browser extensions can
    // mutate <html> attributes before React hydrates (the retired launch-banner
    // pre-paint script did; extensions still do). Suppression applies to this
    // element's attributes only — children are still fully validated.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Facebook Domain Verification (site-ownership proof only — loads nothing) */}
        <meta name="facebook-domain-verification" content="gqf9ydy92vx2nn9eq1bmw3yyf0wu8z" />
        {/* 2026-07-17: Google Analytics/Ads, Meta Pixel, and Reddit Pixel are now
            CONSENT-GATED — they load exclusively via <ConsentManager /> after the
            visitor explicitly accepts. Nothing tracking-related loads here. */}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${notoSansJP.variable} antialiased bg-gray-50`}
      >
        <ClientLayout>
          {/* Status bar will be rendered here at the top */}
          <div className="flex flex-col min-h-screen">
            <Navigation />
            <main className="flex-grow">
              {children}
            </main>
            <Footer />
          </div>
          <ConsentManager />
        </ClientLayout>
      </body>
    </html>
  );
}
