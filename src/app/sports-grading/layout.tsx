import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sports Card Grading — Instant AI Grades, Verified Against 2,900+ Sets',
  description:
    'Grade sports cards instantly with DCM Optic™. Every card is matched against a catalog of 2,951 sets spanning 1901 to 2026, so parallels, serial numbering and rookie status are verified — not guessed. Baseball, basketball, football, hockey and more. From $0.50 a card.',
  keywords:
    'sports card grading, grade sports cards, baseball card grading, basketball card grading, football card grading, hockey card grading, rookie card grading, PSA alternative, prizm parallel grading, topps chrome grading, bowman 1st grading, vintage baseball card grading, patch auto grading, instant sports grading',
  alternates: {
    canonical: 'https://dcmgrading.com/sports-grading',
  },
  openGraph: {
    title: 'Sports Card Grading — Instant AI Results | DCM Grading',
    description:
      'Instant sports grades with verified set and parallel identification across 2,951 sets, 1901 to 2026. Chrome surface, thick-stock corners and vintage centering inspected at magnification.',
    url: 'https://dcmgrading.com/sports-grading',
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
    title: 'Sports Card Grading — Instant AI Results',
    description:
      'Instant sports grades with verified set and parallel ID across 2,951 sets. Chrome, corners and centering inspected at magnification.',
    images: ['/Sports/DCM-Card-LeBron-James-547249-front.jpg'],
  },
};

// Structured data. The FAQ entries below MUST stay in sync with the visible
// FAQ in page.tsx — Google penalises FAQ markup that isn't on the page.
const serviceJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'Sports Card Grading',
  serviceType: 'Trading card grading',
  provider: {
    '@type': 'Organization',
    name: 'DCM Grading',
    url: 'https://dcmgrading.com',
  },
  areaServed: 'Worldwide',
  description:
    'AI-powered sports card grading with four sub-grades, magnified defect inspection, and set/parallel identification verified against a catalog of 2,951 sports sets from 1901 to 2026.',
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
        text: 'No, and we do not claim it is. DCM is its own 10-point grade with four sub-grades, and every report includes estimated equivalents on the PSA, BGS, SGC and CGC scales so you know roughly where a card would land. Most collectors use DCM to decide which cards are worth paying to submit.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can you tell a base card from its parallel?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'That is exactly what the set database is for. Prizm Silver, Optic Holo, Refractors and numbered parallels share artwork and card numbers with the base card, so we match against the real set list and read the serial numbering off the card rather than guessing from the photo.',
      },
    },
    {
      '@type': 'Question',
      name: 'Does it work on vintage cards?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes — the catalog goes back to 1901. Vintage centering and edge wear are what the magnified inspection is tuned for, and the set data supplies the year for cards that never printed one. Vintage legitimately grades lower on average; the report shows the measurements behind the number.',
      },
    },
    {
      '@type': 'Question',
      name: 'What about patch cards, autos and relics?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'They grade fine. Thick stock corners and on-card autographs are inspected the same way, and the label carries the auto and memorabilia flags. Cards with an embedded relic window are surface-scored around the window rather than through it.',
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

export default function SportsGradingLayout({
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
