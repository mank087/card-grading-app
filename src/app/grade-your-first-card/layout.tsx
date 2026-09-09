import { completeMetadata } from '@/lib/seo/completeMetadata'
import { Metadata } from 'next'

export const metadata: Metadata = completeMetadata({
  twitter: { card: 'summary', title: 'DCM - Grade Your First Card', description: 'Learn how to grade your first trading card with DCM Grading. Get tips on photo quality, defect reporting, and see example grading results. Start with 2 free credits!', images: ['/DCM-logo.png'] },
  alternates: { canonical: 'https://dcmgrading.com/grade-your-first-card' },
  title: 'DCM - Grade Your First Card',
  description: "Grade your first trading card with DCM. Learn how to photograph cards, submit images and read condition findings. Start with two free credits.",
  openGraph: {
    images: [{ url: '/DCM-logo.png', alt: 'DCM Grading' }],
    url: 'https://dcmgrading.com/grade-your-first-card',
    title: 'Grade Your First Card | DCM Grading',
    description: 'Learn how to grade your first trading card with DCM Grading. Get tips on photo quality, defect reporting, and see example grading results.',
    type: 'website',
  },
})

export default function GradeYourFirstCardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
