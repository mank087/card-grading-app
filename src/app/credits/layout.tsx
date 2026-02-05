import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Buy Credits - Pricing & Packages',
  description: 'Purchase grading credits for DCM Optic™ AI card grading. Choose from Basic, Pro, Elite, or VIP packages. Starting at $0.66 per grade. Instant results for Sports, Pokemon, MTG, and more.',
  keywords: 'card grading pricing, buy grading credits, DCM credits, trading card grading cost, AI grading packages, cheap card grading',
  openGraph: {
    title: 'Buy Credits - DCM Grading Pricing & Packages',
    description: 'Purchase grading credits for DCM Optic™ AI card grading. Starting at $0.66 per grade with VIP package.',
    type: 'website',
    siteName: 'DCM Grading',
  },
  twitter: {
    card: 'summary',
    title: 'Buy Credits - DCM Grading Pricing',
    description: 'AI card grading starting at $0.66 per grade. Instant results for Sports, Pokemon, MTG cards.',
  },
};

export default function CreditsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
