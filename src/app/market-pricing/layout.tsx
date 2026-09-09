import { completeMetadata } from '@/lib/seo/completeMetadata'
import { Metadata } from 'next';

export const metadata: Metadata = completeMetadata({
  alternates: { canonical: 'https://dcmgrading.com/market-pricing' },
  title: { absolute: 'Portfolio | DCM Grading' },
  description: 'Track your graded card collection value with live market data — free for every DCM user. On-demand price refresh available with Card Lovers.',
  keywords: 'card portfolio, collection value, card market pricing, card price trends, DCM portfolio',
  openGraph: {
    images: [{ url: '/DCM-logo.png', alt: 'DCM Grading' }],
    url: 'https://dcmgrading.com/market-pricing',
    title: 'Portfolio | DCM Grading',
    description: 'Track your graded card collection value with live market data — free for every DCM user.',
    type: 'website',
    siteName: 'DCM Grading',
  },
});

export default function MarketPricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
