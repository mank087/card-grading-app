import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pokémon Card Grading — Instant AI Grades, Verified Against 26,000+ Cards',
  description:
    'Grade Pokémon cards instantly with DCM Optic™. Every card is matched against our own database of 20,933 English and 5,548 Japanese cards across 322 sets, so the set, number and rarity on your label are verified. Base Set Charizard to Prismatic Evolutions. From $0.50 a card.',
  keywords:
    'pokemon card grading, grade pokemon cards, pokemon PSA, charizard grading, pikachu card grade, vintage pokemon grading, WOTC card grading, base set charizard grade, japanese pokemon card grading, holo scratch grading, modern pokemon grading, AI pokemon grading, instant pokemon grades',
  alternates: {
    canonical: 'https://dcmgrading.com/pokemon-grading',
  },
  openGraph: {
    title: 'Pokémon Card Grading — Instant AI Results | DCM Grading',
    description:
      'Instant Pokémon grades with verified card identification across 322 English and Japanese sets. Holo surface, edge whitening and vintage centering inspected at magnification.',
    url: 'https://dcmgrading.com/pokemon-grading',
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
    title: 'Pokémon Card Grading — Instant AI Results',
    description:
      'Instant Pokémon grades with verified card ID across 322 sets. Holo, edge and centering inspected at magnification.',
    images: ['/Pokemon/DCM-Card-Umbreon-ex-887696-front.jpg'],
  },
};

// Structured data. The FAQ entries below MUST stay in sync with the visible
// FAQ in page.tsx — Google penalises FAQ markup that isn't on the page.
const serviceJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'Pokémon Card Grading',
  serviceType: 'Trading card grading',
  provider: {
    '@type': 'Organization',
    name: 'DCM Grading',
    url: 'https://dcmgrading.com',
  },
  areaServed: 'Worldwide',
  description:
    'AI-powered Pokémon card grading with four sub-grades, magnified defect inspection, and card identification verified against a database of 26,481 English and Japanese Pokémon cards.',
  offers: {
    '@type': 'Offer',
    price: '0.50',
    priceCurrency: 'USD',
    description: 'Per-card grading, price varies by credit package',
  },
};

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Is a DCM grade the same as a PSA grade?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'No, and we do not claim it is. DCM is its own 10-point grade with four sub-grades, and every report includes estimated equivalents on the PSA, BGS, CGC and SGC scales so you know roughly where a card would land. Most collectors use DCM to decide which cards are worth paying to submit.',
      },
    },
    {
      '@type': 'Question',
      name: 'Does it work on vintage WOTC cards?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. Base Set through Neo and the WOTC promos are all in our database, and vintage centering and edge wear are exactly what the magnified inspection is tuned for. Vintage cards legitimately grade lower on average — the report shows you the measurements behind the number.',
      },
    },
    {
      '@type': 'Question',
      name: 'What about Japanese cards?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Japanese sets have their own database with 5,548 cards across 145 sets, so a Japanese promo is matched against Japanese data rather than guessed at from the closest English name.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can you grade a card that is already slabbed?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'We can read it, but we will tell you the grade is limited. A card sealed in another company’s case cannot be inspected for surface and edge detail through the plastic, so the report says so rather than quietly guessing.',
      },
    },
    {
      '@type': 'Question',
      name: 'What if I disagree with my grade?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Every report shows the sub-grades and the specific defects behind the number, so you can see the reasoning. Photo quality is the most common cause of a surprising grade — retake with even lighting and no glare and grade it again.',
      },
    },
  ],
};

export default function PokemonGradingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      {children}
    </>
  );
}
