import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Why DCM Grading? | Card Grading for Collectors, by Collectors',
  description:
    'DCM Grading puts the power of card grading in your hands. Instant results, detailed reports, market pricing, custom labels, eBay InstaList, and portfolio tracking. Grade your cards from home — no mailing, no waiting.',
  openGraph: {
    title: 'Why DCM Grading?',
    description:
      'Grade your cards from home with DCM Optic\u2122 technology. Instant results, market pricing, custom labels, and more.',
    url: 'https://dcmgrading.com/why-dcm',
    siteName: 'DCM Grading',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Why DCM Grading?',
    description:
      'Grade your cards from home with DCM Optic\u2122 technology. Instant results, market pricing, custom labels, and more.',
  },
  keywords: [
    'card grading',
    'grade cards at home',
    'card grading service',
    'pokemon card grading',
    'sports card grading',
    'affordable card grading',
    'instant card grading',
    'card grading alternative',
    'DCM grading',
    'trading card grading',
  ],
}

export default function WhyDcmLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
