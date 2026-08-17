import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Grade Your Card - Upload Photos',
  description: 'Upload your trading card photos to get an instant grade powered by DCM Optic™. It analyzes centering, corners, edges, and surface for accurate results in seconds.',
  keywords: 'grade card, upload card, online card grading, instant grading, card analysis, centering check, corner analysis',
  openGraph: {
    title: 'Grade Your Card - Upload Photos | DCM Grading',
    description: 'Upload card photos for instant grading powered by DCM Optic™. Get accurate results in seconds.',
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
