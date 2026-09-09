import { completeMetadata } from '@/lib/seo/completeMetadata'
import { Metadata } from 'next';

export const metadata: Metadata = completeMetadata({
  twitter: { card: 'summary', title: 'Contact Us', description: 'Get in touch with DCM Grading. We\'re here to help with questions about card grading, technical support, account issues, and feedback. Reach us via email or our contact form.', images: ['/DCM-logo.png'] },
  alternates: { canonical: 'https://dcmgrading.com/contact' },
  title: 'Contact Us',
  description: "Contact DCM Grading for help with card grading, technical support, account questions or feedback. Use our contact form or email the team.",
  keywords: 'contact DCM, card grading support, DCM help, grading questions, customer service',
  openGraph: {
    images: [{ url: '/DCM-logo.png', alt: 'DCM Grading' }],
    url: 'https://dcmgrading.com/contact',
    title: 'Contact DCM Grading',
    description: 'Have questions about card grading? Get in touch with our team. We typically respond within 24-48 hours.',
    type: 'website',
  },
});

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
