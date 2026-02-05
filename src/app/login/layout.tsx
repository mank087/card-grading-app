import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Login or Sign Up',
  description: 'Sign in to your DCM Grading account or create a new account. Get 1 free credit when you sign up to grade your first card.',
  keywords: 'DCM login, sign up, create account, card grading account, free grading credit',
  openGraph: {
    title: 'Login or Sign Up | DCM Grading',
    description: 'Sign in or create an account. Get 1 free credit to grade your first card.',
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
