import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Card Grading Service - AI-Powered Trading Card Grades',
  description: 'Professional AI card grading for all trading cards. Get instant, accurate grades for Pokemon, Sports, MTG, Lorcana, One Piece & more. DCM Optic™ 30-point inspection with downloadable labels.',
  keywords: 'card grading, trading card grading, AI card grading, online card grading, instant card grading, professional grading, card authentication, PSA alternative, BGS alternative',
  openGraph: {
    title: 'Card Grading Service - AI-Powered Trading Card Grades | DCM',
    description: 'Professional AI grading for all trading cards. Pokemon, Sports, MTG & more. Instant results with downloadable labels.',
    type: 'website',
    siteName: 'DCM Grading',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Card Grading Service - AI-Powered Results',
    description: 'Professional AI grading for Pokemon, Sports, MTG & more. Instant results.',
  },
};

export default function CardGradingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
