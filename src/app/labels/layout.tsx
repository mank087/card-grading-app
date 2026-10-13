import { completeMetadata } from '@/lib/seo/completeMetadata'
import type { Metadata } from 'next'

export const metadata: Metadata = completeMetadata({
  alternates: { canonical: 'https://dcmgrading.com/labels' },
  title: { absolute: 'Free Grading Label Maker: Label Studio | DCM Grading' },
  description:
    'Design and print custom grading labels for DCM-graded cards, free. Slab labels, one-touch (Avery 6871) and toploader (Avery 8167) sheets in five steps.',
  openGraph: {
    images: [{ url: '/DCM-logo.png', alt: 'DCM Grading' }],
    title: 'DCM Label Studio: Free Custom Grading Label Maker',
    description:
      'Design and print grading labels for slabs, one-touch holders and toploaders. Heritage, Modern and Traditional styles, custom colors, fold-over support.',
    url: 'https://dcmgrading.com/labels',
    siteName: 'DCM Grading',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DCM Label Studio: Free Custom Grading Label Maker',
    description:
      'Design and print professional grading labels for card slabs, one-touch holders, and toploaders.',
  },
  keywords: [
    'card grading labels',
    'custom grading labels',
    'slab labels',
    'one-touch labels',
    'toploader labels',
    'graded card labels',
    'print grading labels',
    'card label maker',
    'DCM grading labels',
    'trading card labels',
    'custom slab labels',
    'label studio',
    'grading label design',
    'card display labels',
    'fold-over labels',
    'free grading label maker',
    'how to make a grading label',
    'Avery 6871 labels',
    'Avery 8167 labels',
    'Zion Mag Pro labels',
  ],
})

export default function LabelsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
