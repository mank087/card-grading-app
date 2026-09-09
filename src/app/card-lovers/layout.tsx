import { MarketingServiceSchema } from '@/components/marketing/MarketingServiceSchema'
import { completeMetadata } from '@/lib/seo/completeMetadata'
import { MarketingShowcaseBoundary } from '@/components/marketing/MarketingShowcaseBoundary'
import { Metadata } from 'next';

export const metadata: Metadata = completeMetadata({
  alternates: { canonical: 'https://dcmgrading.com/card-lovers' },
  title: 'Card Lovers Program - Monthly Subscription',
  description: "Join Card Lovers for 70 credits monthly or 900 yearly, member purchase discounts and an exclusive label emblem. Compare monthly and annual plans.",
  keywords: 'card grading subscription, monthly grading credits, Card Lovers, DCM subscription, grading membership, cheapest card grading',
  openGraph: {
    images: [{ url: '/DCM-logo.png', alt: 'DCM Grading' }],
    url: 'https://dcmgrading.com/card-lovers',
    title: 'Card Lovers Program - Monthly Grading Subscription | DCM',
    description: 'Join Card Lovers: 70 credits/month, 20% off purchases, exclusive emblem. Annual plan just $0.50 per grade - our lowest price ever.',
    type: 'website',
    siteName: 'DCM Grading',
  },
  twitter: {
    card: 'summary',
    title: 'Card Lovers - DCM Grading Subscription',
    description: '70 credits/month + 20% off + exclusive emblem. Annual plan just $0.50 per grade.',
  },
});

export default function CardLoversLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MarketingShowcaseBoundary selection="1"><MarketingServiceSchema page="card-lovers" />{children}</MarketingShowcaseBoundary>;
}
