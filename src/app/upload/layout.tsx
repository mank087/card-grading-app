import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Grade Your Card - Upload Photos',
  description: 'Upload your trading card photos to get an instant AI-powered grade. DCM Optic™ analyzes centering, corners, edges, and surface for accurate results in seconds.',
  keywords: 'grade card, upload card, AI card grading, instant grading, card analysis, centering check, corner analysis',
  openGraph: {
    title: 'Grade Your Card - Upload Photos | DCM Grading',
    description: 'Upload card photos for instant AI-powered grading. Get accurate results in seconds.',
    type: 'website',
    siteName: 'DCM Grading',
  },
};

export default function UploadLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
