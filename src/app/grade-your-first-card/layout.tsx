import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'DCM - Grade Your First Card',
  description: 'Learn how to grade your first trading card with DCM Grading. Get tips on photo quality, defect reporting, and see example grading results. Start with 1 free credit!',
  openGraph: {
    title: 'Grade Your First Card | DCM Grading',
    description: 'Learn how to grade your first trading card with DCM Grading. Get tips on photo quality, defect reporting, and see example grading results.',
    type: 'website',
  },
}

export default function GradeYourFirstCardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
