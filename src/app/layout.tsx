import { completeMetadata } from '@/lib/seo/completeMetadata'
import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_JP, Manrope, Inter } from "next/font/google";
import "./globals.css";
import "./design-system.css";
import Navigation from "./ui/Navigation";
import Footer from "./ui/Footer";
import ClientLayout from "@/components/ClientLayout";
import ConsentManager from "@/components/consent/ConsentManager";
import { homeMetadata } from "./metadata";

const geistSans = Geist({
  preload: false,
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  preload: false,
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Used only by migrated surfaces and site chrome, not exported labels.
const dcmDisplay = Manrope({ variable: '--font-dcm-display', subsets: ['latin'], display: 'swap' });
const dcmBody = Inter({ variable: '--font-dcm-body', subsets: ['latin'], display: 'swap' });

const notoSansJP = Noto_Sans_JP({
  preload: false,
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = completeMetadata({
  metadataBase: new URL('https://dcmgrading.com'),
  ...homeMetadata,
  // Default metadata that can be overridden by child pages
  title: {
    default: String(homeMetadata.title),
    template: '%s | DCM Grading',
  },
  alternates: {
    // NOTE: deliberately no `canonical` here. Metadata is merged down the tree,
    // so a canonical set on the root layout would be inherited by every page
    // that does not set its own and point the whole site at one URL. Canonicals
    // live on the individual pages/layouts. `types` is safe to inherit.
    types: {
      'application/rss+xml': [
        { url: 'https://dcmgrading.com/rss.xml', title: 'DCM Grading Blog' },
      ],
    },
  },
});

// Site-wide identity graph. Rendered server-side in <head> on every page so
// answer engines and rich results resolve one canonical Organization node
// (@id) that page-level schema can reference.
const SITE_JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://dcmgrading.com/#organization',
      name: 'DCM Grading',
      legalName: 'Dynamic Collectibles Management LLC',
      url: 'https://dcmgrading.com',
      logo: {
        '@type': 'ImageObject',
        url: 'https://dcmgrading.com/DCM-logo.png',
        width: 1024,
        height: 1024,
      },
      description:
        'DCM Grading is an AI-powered trading card grading platform that grades trading cards from photos using DCM Optic™ and issues printable labels collectors apply to their own slabs.',
      // Support is email-only: there is no published phone number, so
      // `telephone` is deliberately omitted rather than invented. The address
      // below is the one published on /contact, /faq, /privacy and /terms.
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: 'admin@dcmgrading.com',
        url: 'https://dcmgrading.com/contact',
        availableLanguage: ['English'],
      },
      sameAs: [
        'https://www.facebook.com/dcmgrading',
        'https://www.instagram.com/dcm_grading/',
        'https://x.com/DCM_Grading',
        'https://www.youtube.com/@DCM-Grading',
        'https://www.tiktok.com/@dcm_grading',
      ],
    },
    {
      '@type': 'WebSite',
      '@id': 'https://dcmgrading.com/#website',
      name: 'DCM Grading',
      url: 'https://dcmgrading.com',
      inLanguage: 'en-US',
      publisher: { '@id': 'https://dcmgrading.com/#organization' },
      // No SearchAction: /search is a serial-number lookup, not general site
      // search — advertising it as such would route junk queries there.
    },
  ],
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
        {/* Embedded-mode stamp (2026-09-09). The installed iOS/Android apps load
            these pages in a WebView. Older installed builds inject
            `header, nav, footer { display: none }` into every embedded page, which
            also nukes in-content elements — so in-content markup no longer uses
            those tags (see src/app/embedded-chrome.test.ts) and the real chrome
            carries data-site-chrome instead. This stamps html[data-embedded="1"]
            when the WebView UA says DCMGradingApp/ or the URL carries ?app=1, so a
            FUTURE app build can drop its blunt CSS and rely on the precise rule in
            globals.css. Runs pre-paint (no flash) and keeps every page statically
            renderable — reading headers() here would force all routes dynamic.
            Inert in normal browsers: neither condition matches. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(/DCMGradingApp\\//.test(navigator.userAgent)||/[?&]app=1(&|$)/.test(location.search)){document.documentElement.setAttribute('data-embedded','1')}}catch(e){}",
          }}
        />
        {/* Facebook Domain Verification (site-ownership proof only — loads nothing) */}
        <meta name="facebook-domain-verification" content="gqf9ydy92vx2nn9eq1bmw3yyf0wu8z" />
        {/* Site-wide Organization + WebSite structured data (server-rendered) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(SITE_JSON_LD) }}
        />
        {/* 2026-07-17: Google Analytics/Ads, Meta Pixel, and Reddit Pixel are now
            CONSENT-GATED — they load exclusively via <ConsentManager /> after the
            visitor explicitly accepts. Nothing tracking-related loads here. */}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${notoSansJP.variable} ${dcmDisplay.variable} ${dcmBody.variable} antialiased bg-gray-50`}
      >
        <a href="#main-content" className="dcm-skip-link">Skip to content</a>
        <ClientLayout>
          {/* Status bar will be rendered here at the top */}
          <div className="flex flex-col min-h-screen">
            <Navigation />
            <main id="main-content" tabIndex={-1} className="flex-grow">
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
