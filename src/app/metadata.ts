import { Metadata } from 'next';

// Homepage metadata - exported and used in layout.tsx
export const homeMetadata: Metadata = {
  title: 'DCM Grading - AI-Powered Trading Card Grading | Sports, Pokemon, MTG',
  description: 'Professional AI card grading powered by DCM Optic™. Get instant, accurate grades for Sports Cards, Pokemon, Magic: The Gathering, Disney Lorcana and more. 30-point inspection with downloadable labels and reports.',
  // Icons for Google Search, browsers, and mobile devices
  // Google requires icons to be at least 48x48, prefers 192x192+
  // To generate proper icons: use https://realfavicongenerator.net/
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/DCM-logo.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/DCM-logo.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
  },
  keywords: [
    'card grading',
    'trading card grading',
    'AI card grading',
    'sports card grading',
    'pokemon card grading',
    'MTG card grading',
    'magic the gathering grading',
    'disney lorcana grading',
    'DCM grading',
    'professional card grading',
    'card authentication',
    'PSA alternative',
    'BGS alternative',
    'instant card grading',
    'online card grading',
  ].join(', '),
  openGraph: {
    title: 'DCM Grading - AI-Powered Trading Card Grading',
    description: 'Professional AI card grading powered by DCM Optic™. Get instant, accurate grades for Sports Cards, Pokemon, MTG, and more.',
    type: 'website',
    siteName: 'DCM Grading',
    locale: 'en_US',
    images: [
      {
        url: '/DCM-logo.png',
        width: 512,
        height: 512,
        alt: 'DCM Grading Logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DCM Grading - AI-Powered Trading Card Grading',
    description: 'Professional AI card grading powered by DCM Optic™. Instant grades for Sports, Pokemon, MTG cards.',
    creator: '@DCM_Grading',
    images: ['/DCM-logo.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};
