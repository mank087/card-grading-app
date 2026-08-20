import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Label Studio Classic — Full Label Designer | DCM Grading',
  description:
    'The original single-page Label Studio: every dimension, color, pattern, and text control on one screen. Design and print grading labels for slabs, one-touch holders, and toploaders.',
  robots: { index: false },
}

export default function ClassicLabelsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
