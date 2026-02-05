import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Card Lovers Program - Monthly Subscription',
  description: 'Join the Card Lovers subscription: Get 70 credits monthly, 20% off all purchases, exclusive heart emblem, and credits that never expire. Annual plan just $0.50 per grade.',
  keywords: 'card grading subscription, monthly grading credits, Card Lovers, DCM subscription, grading membership, cheapest card grading',
  openGraph: {
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
};

export default function CardLoversLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
