import { completeMetadata } from '@/lib/seo/completeMetadata'
import type { Metadata } from 'next'

export const metadata: Metadata = completeMetadata({
  alternates: { canonical: 'https://dcmgrading.com/labels' },
  title: { absolute: 'Label Studio: Custom Grading Labels | DCM Grading' },
  description:
    "Create printable grading labels for slabs, one-touch holders and top loaders. Customize colors, patterns and dimensions with DCM Label Studio.",
  openGraph: {
    images: [{ url: '/DCM-logo.png', alt: 'DCM Grading' }],
    title: 'Label Studio — Custom Grading Labels',
    description:
      'Design professional grading labels for slabs, one-touch holders, and toploaders. Custom colors, batch printing, and fold-over support.',
    url: 'https://dcmgrading.com/labels',
    siteName: 'DCM Grading',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Label Studio — Custom Grading Labels | DCM Grading',
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
  ],
})

export default function LabelsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
