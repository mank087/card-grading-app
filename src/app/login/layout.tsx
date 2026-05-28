import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Login or Sign Up',
  description: 'Sign in to your DCM Grading account or create a new account. Get 2 free credits when you sign up to grade your first cards.',
  keywords: 'DCM login, sign up, create account, card grading account, free grading credit',
  openGraph: {
    title: 'Login or Sign Up | DCM Grading',
    description: 'Sign in or create an account. Get 2 free credits to grade your first cards.',
    type: 'website',
    siteName: 'DCM Grading',
  },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
