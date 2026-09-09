import { completeMetadata } from '@/lib/seo/completeMetadata'
import { Metadata } from 'next';

export const metadata: Metadata = completeMetadata({
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  title: 'Grade Your Card - Upload Photos',
  description: 'Upload front and back photos to get an instant grade from DCM Optic™: centering, corners, edges and surface, with a condition report in seconds.',
  keywords: 'grade card, upload card, online card grading, instant grading, card analysis, centering check, corner analysis',
  openGraph: {
    title: 'Grade Your Card - Upload Photos | DCM Grading',
    description: 'Upload card photos for instant grading powered by DCM Optic™. Get accurate results in seconds.',
    type: 'website',
    siteName: 'DCM Grading',
  },
});

export default function UploadLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
