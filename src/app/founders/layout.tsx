import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Founders Package - Exclusive 150 Credits',
  description: 'Become a DCM Founder: Get 150 grading credits, exclusive Founder star emblem on all labels, and lifetime recognition. Join our founding community of collectors.',
  keywords: 'DCM Founders, founder package, exclusive card grading, founder emblem, founding member, collector community',
  openGraph: {
    title: 'Founders Package - Join DCM\'s Founding Community',
    description: 'Get 150 grading credits + exclusive Founder emblem. Join our founding community of collectors.',
    type: 'website',
    siteName: 'DCM Grading',
  },
  twitter: {
    card: 'summary',
    title: 'Founders Package - DCM Grading',
    description: '150 credits + Founder emblem. Join DCM\'s founding community.',
  },
};

export default function FoundersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
