import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Founders (program closed) - see Card Lovers',
  description: 'The DCM Founders program is closed to new members. Existing Founders keep their credits and Founder emblem. For an ongoing plan, see Card Lovers.',
  robots: { index: false, follow: true },
  openGraph: {
    title: 'Founders (program closed) - DCM Grading',
    description: 'The Founders program is closed to new members. See Card Lovers for our current plans.',
    type: 'website',
    siteName: 'DCM Grading',
  },
  twitter: {
    card: 'summary',
    title: 'Founders (program closed) - DCM Grading',
    description: 'Closed to new members. See Card Lovers for our current plans.',
  },
};

export default function FoundersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
