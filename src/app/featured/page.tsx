import type { Metadata } from 'next'
import FeaturedPageClient from './FeaturedPageClient'

export const metadata: Metadata = {
  title: 'Featured Cards',
  description: 'Browse our curated showcase of cards graded by DCM Optic™. See detailed grade reports with centering, corners, edges, and surface sub-scores, market pricing estimates, and front & back slab images for Pokemon, Sports, MTG, Lorcana, and One Piece cards.',
  keywords: [
    'featured graded cards',
    'DCM Optic graded trading cards',
    'graded card showcase',
    'pokemon graded cards',
    'sports card grades',
    'MTG graded cards',
    'card grading results',
    'DCM grading examples',
    'trading card sub scores',
    'card condition analysis',
    'graded card gallery',
    'card market pricing',
  ].join(', '),
  openGraph: {
    title: 'Featured Cards | DCM Grading',
    description: 'Explore our curated gallery of DCM Optic™ graded trading cards with detailed condition analysis, sub-scores, and market pricing estimates. Pokemon, Sports, MTG, Lorcana & One Piece.',
    type: 'website',
    siteName: 'DCM Grading',
    locale: 'en_US',
    url: 'https://dcmgrading.com/featured',
    images: [
      {
        url: '/DCM-logo.png',
        width: 512,
        height: 512,
        alt: 'DCM Grading - Featured Cards Graded by DCM Optic™',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Featured Cards | DCM Grading',
    description: 'Browse our curated showcase of DCM Optic™ graded trading cards with detailed grades, sub-scores, and market pricing.',
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
  alternates: {
    canonical: 'https://dcmgrading.com/featured',
  },
}

export default function FeaturedPage() {
  return <FeaturedPageClient />
}
