import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pokemon Card Grading - AI-Powered Instant Results',
  description: 'Grade your Pokemon cards instantly with DCM Optic™ AI technology. Get accurate grades for Charizard, Pikachu, vintage holos, modern cards & more. PSA-comparable results in seconds.',
  keywords: 'pokemon card grading, grade pokemon cards, pokemon PSA, charizard grading, pikachu card grade, vintage pokemon grading, modern pokemon grading, AI pokemon grading, instant pokemon grades',
  openGraph: {
    title: 'Pokemon Card Grading - Instant AI Results | DCM Grading',
    description: 'Grade your Pokemon cards instantly. Charizard, Pikachu, vintage holos & more. PSA-comparable results in seconds.',
    type: 'website',
    siteName: 'DCM Grading',
    images: [
      {
        url: '/Pokemon/DCM-Card-Umbreon-ex-887696-front.jpg',
        width: 600,
        height: 800,
        alt: 'Graded Pokemon Card',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pokemon Card Grading - Instant AI Results',
    description: 'Grade your Pokemon cards instantly with DCM Optic™. PSA-comparable results in seconds.',
    images: ['/Pokemon/DCM-Card-Umbreon-ex-887696-front.jpg'],
  },
};

export default function PokemonGradingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
