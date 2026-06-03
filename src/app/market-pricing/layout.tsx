import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Market Pricing & Portfolio Dashboard | DCM',
  description: 'Track your graded card collection value with live market data — free for every DCM user. On-demand price refresh available with Card Lovers.',
  keywords: 'card market pricing, collection value, card portfolio, card price trends, DCM market pricing',
  openGraph: {
    title: 'Market Pricing & Portfolio Dashboard | DCM',
    description: 'Track your graded card collection value with live market data — free for every DCM user.',
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
