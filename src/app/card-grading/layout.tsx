import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Card Grading Service - Trading Card Grades Powered by DCM Optic™',
  description: 'Professional card grading powered by DCM Optic™ for all trading cards. Get instant, accurate grades for Pokemon, Sports, MTG, Lorcana, One Piece & more. 30-point DCM Optic™ inspection with downloadable labels. As low as $0.50 a card with Card Lovers Annual, or $2.99 for a single card.',
  keywords: 'card grading, trading card grading, online card grading, instant card grading, professional grading, card authentication, PSA alternative, BGS alternative',
  openGraph: {
    title: 'Card Grading Service - Powered by DCM Optic™ | DCM',
    description: 'Professional grading powered by DCM Optic™ for all trading cards. Pokemon, Sports, MTG & more. Instant results with downloadable labels.',
    type: 'website',
    siteName: 'DCM Grading',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Card Grading Service - Powered by DCM Optic™',
    description: 'Professional grading powered by DCM Optic™ for Pokemon, Sports, MTG & more. Instant results.',
  },
};

export default function CardGradingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
