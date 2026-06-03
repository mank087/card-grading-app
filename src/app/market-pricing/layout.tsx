import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Portfolio | DCM Grading',
  description: 'Track your graded card collection value with live market data — free for every DCM user. On-demand price refresh available with Card Lovers.',
  keywords: 'card portfolio, collection value, card market pricing, card price trends, DCM portfolio',
  openGraph: {
    title: 'Portfolio | DCM Grading',
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
