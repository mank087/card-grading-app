import { MarketingServiceSchema } from '@/components/marketing/MarketingServiceSchema'
import { completeMetadata } from '@/lib/seo/completeMetadata'
import { MarketingShowcaseBoundary } from '@/components/marketing/MarketingShowcaseBoundary'
import type { Metadata } from 'next'

export const metadata: Metadata = completeMetadata({
  title: { absolute: 'Why DCM Grading? | Card Grading for Collectors' },
  description:
    "Explore everything DCM can do: card grading, condition reports, Heritage labels, portfolio tracking, market pricing and eBay InstaList.",
  openGraph: {
    images: [{ url: '/DCM-logo.png', alt: 'DCM Grading' }],
    title: 'Why DCM Grading?',
    description:
      'Grade your cards from home with DCM Optic™ technology. Instant results, market pricing, custom labels, and more.',
    url: 'https://dcmgrading.com/why-dcm',
    siteName: 'DCM Grading',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Why DCM Grading?',
    description:
      'Grade your cards from home with DCM Optic™ technology. Instant results, market pricing, custom labels, and more.',
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
  alternates: {
    canonical: 'https://dcmgrading.com/why-dcm',
  },
})

export default function WhyDcmLayout({ children }: { children: React.ReactNode }) {
  return <><MarketingShowcaseBoundary selection="why-dcm"><MarketingServiceSchema page="why-dcm" />{children}</MarketingShowcaseBoundary></>
}
