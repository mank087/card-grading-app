import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'VIP Package - 150 Credits at Best Value',
  description: 'Get the DCM VIP Package: 150 grading credits for just $99 ($0.66 per grade). Includes exclusive VIP diamond emblem on all your card labels. Our best value for serious collectors.',
  keywords: 'VIP card grading, bulk grading credits, cheap card grading, DCM VIP, best grading value, 150 credits',
  openGraph: {
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
};

export default function VipLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
