import { Metadata } from 'next';

// Homepage metadata - exported and used in layout.tsx
export const homeMetadata: Metadata = {
  title: 'DCM Grading - AI Card Grading for Pokemon, Sports, MTG & More',
  description: 'Professional AI card grading powered by DCM Optic™. Get instant, accurate grades for Pokemon, Sports Cards, Magic: The Gathering, Lorcana & One Piece. 30-point inspection starting at $0.50/grade with downloadable labels.',
  // Icons for Google Search, browsers, and mobile devices
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
      { url: '/web-app-manifest-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/web-app-manifest-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/web-app-manifest-192x192.png', sizes: '180x180', type: 'image/png' },
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
    title: 'DCM Grading - AI Card Grading for Pokemon, Sports, MTG & More',
    description: 'Professional AI card grading powered by DCM Optic™. Instant grades for Pokemon, Sports Cards, MTG, Lorcana & One Piece. Starting at $0.50/grade.',
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
    title: 'DCM Grading - AI Card Grading',
    description: 'Instant AI grades for Pokemon, Sports, MTG & more. Starting at $0.50/grade with DCM Optic™.',
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
