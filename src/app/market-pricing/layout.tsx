import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Market Pricing - Card Lovers Exclusive | DCM',
  description: 'Track your card collection value, view market trends, and list cards on eBay. Exclusive portfolio dashboard for Card Lovers subscribers.',
  keywords: 'card market pricing, collection value, card portfolio, eBay listing, card price trends, DCM market pricing',
  openGraph: {
    title: 'Market Pricing - Card Lovers Exclusive | DCM',
    description: 'Track your card collection value, view market trends, and list cards on eBay. Exclusive to Card Lovers subscribers.',
    type: 'website',
    siteName: 'DCM Grading',
  },
};

export default function MarketPricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
