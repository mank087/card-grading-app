import { Metadata } from 'next';

// Homepage metadata - exported and used in layout.tsx
export const homeMetadata: Metadata = {
  title: 'DCM Grading - Instant Card Grading for Pokemon, Sports, MTG & More',
  description: 'Professional card grading powered by DCM Optic™. Get instant, accurate grades for Pokemon, Sports Cards, Magic: The Gathering, Lorcana & One Piece. Multi-point inspection, as low as $0.50 a card with Card Lovers Annual, with downloadable labels.',
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
    'DCM Optic card grading',
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
    title: 'DCM Grading - Instant Card Grading for Pokemon, Sports, MTG & More',
    description: 'Professional card grading powered by DCM Optic™. Instant grades for Pokemon, Sports Cards, MTG, Lorcana & One Piece. As low as $0.50 a card with Card Lovers Annual.',
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
    title: 'DCM Grading - Instant Card Grading',
    description: 'Instant DCM Optic™ grades for Pokemon, Sports, MTG & more. As low as $0.50 a card with Card Lovers Annual.',
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
