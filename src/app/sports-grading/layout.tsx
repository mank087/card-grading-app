import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sports Card Grading - AI-Powered Instant Results',
  description: 'Grade your sports cards instantly with DCM Optic™ AI technology. Baseball, basketball, football, hockey & more. Get PSA-comparable grades for rookie cards, autographs, and vintage cards in seconds.',
  keywords: 'sports card grading, grade sports cards, baseball card grading, basketball card grading, football card grading, hockey card grading, rookie card grading, PSA alternative, instant sports grading',
  openGraph: {
    title: 'Sports Card Grading - Instant AI Results | DCM Grading',
    description: 'Grade sports cards instantly. Baseball, basketball, football, hockey. PSA-comparable results in seconds.',
    type: 'website',
    siteName: 'DCM Grading',
    images: [
      {
        url: '/Sports/DCM-Card-LeBron-James-547249-front.jpg',
        width: 600,
        height: 800,
        alt: 'Graded Sports Card',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sports Card Grading - Instant AI Results',
    description: 'Grade sports cards instantly with DCM Optic™. Baseball, basketball, football & more.',
    images: ['/Sports/DCM-Card-LeBron-James-547249-front.jpg'],
  },
};

export default function SportsGradingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
