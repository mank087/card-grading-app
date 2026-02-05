import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Account - Settings & Preferences',
  description: 'Manage your DCM Grading account settings, subscription, emblem preferences, and profile information.',
  keywords: 'account settings, DCM account, grading preferences, emblem settings, subscription management',
  openGraph: {
    title: 'My Account | DCM Grading',
    description: 'Manage your DCM Grading account settings and preferences.',
    type: 'website',
    siteName: 'DCM Grading',
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
