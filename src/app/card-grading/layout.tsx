import { MarketingServiceSchema } from '@/components/marketing/MarketingServiceSchema'
import { completeMetadata } from '@/lib/seo/completeMetadata'
import { MarketingShowcaseBoundary } from '@/components/marketing/MarketingShowcaseBoundary'
import { Metadata } from 'next';

export const metadata: Metadata = completeMetadata({
  title: "Card Grading Service with DCM Optic",
  description: "Grade trading cards with DCM Optic. Upload front and back photos for four subgrades, condition findings and printable labels. Single-card credits cost $2.99.",
  keywords: 'card grading, trading card grading, online card grading, instant card grading, professional grading, card authentication, PSA alternative, BGS alternative',
  alternates: {
    canonical: 'https://dcmgrading.com/card-grading',
  },
  openGraph: {
    images: [{ url: '/DCM-logo.png', alt: 'DCM Grading' }],
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
});

export default function CardGradingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MarketingShowcaseBoundary selection="grading-standard"><MarketingServiceSchema page="card-grading" />{children}</MarketingShowcaseBoundary>;
}
