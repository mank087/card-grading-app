import { MarketingServiceSchema } from '@/components/marketing/MarketingServiceSchema'
import { completeMetadata } from '@/lib/seo/completeMetadata'
import { MarketingShowcaseBoundary } from '@/components/marketing/MarketingShowcaseBoundary'
import { Metadata } from 'next';

export const metadata: Metadata = completeMetadata({
  alternates: { canonical: 'https://dcmgrading.com/vip' },
  title: 'VIP Package - 150 Credits at Best Value',
  description: "Get 150 DCM grading credits for $99, or $0.66 per grade, plus an exclusive VIP diamond emblem on your labels. Credits never expire.",
  keywords: 'VIP card grading, bulk grading credits, cheap card grading, DCM VIP, best grading value, 150 credits',
  openGraph: {
    images: [{ url: '/DCM-logo.png', alt: 'DCM Grading' }],
    url: 'https://dcmgrading.com/vip',
    title: 'VIP Package - 150 Credits at Best Value | DCM Grading',
    description: 'Get 150 grading credits for $99 + exclusive VIP diamond emblem. Best value for serious collectors at $0.66 per grade.',
    type: 'website',
    siteName: 'DCM Grading',
  },
  twitter: {
    card: 'summary',
    title: 'VIP Package - 150 Credits for $99',
    description: 'Best value card grading: 150 credits + VIP emblem for $99. Just $0.66 per grade.',
  },
});

export default function VipLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MarketingShowcaseBoundary selection="1"><MarketingServiceSchema page="vip" />{children}</MarketingShowcaseBoundary>;
}
