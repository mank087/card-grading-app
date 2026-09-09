import { completeMetadata } from '@/lib/seo/completeMetadata'
import type { Metadata } from 'next'

export const metadata: Metadata = completeMetadata({
  title: { absolute: 'Label Studio Classic — Full Label Designer | DCM Grading' },
  description:
    "Use the classic Label Studio to adjust dimensions, colors, patterns and text on one screen. Design labels for slabs, one-touch holders and top loaders.",
  robots: { index: false },
})

export default function ClassicLabelsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
