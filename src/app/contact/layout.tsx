import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact Us',
  description: 'Get in touch with DCM Grading. We\'re here to help with questions about card grading, technical support, account issues, and feedback. Reach us via email or our contact form.',
  keywords: 'contact DCM, card grading support, DCM help, grading questions, customer service',
  openGraph: {
    title: 'Contact DCM Grading',
    description: 'Have questions about card grading? Get in touch with our team. We typically respond within 24-48 hours.',
    type: 'website',
  },
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
