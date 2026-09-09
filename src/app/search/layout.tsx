import { completeMetadata } from '@/lib/seo/completeMetadata'
import { Metadata } from 'next';

export const metadata: Metadata = completeMetadata({
  robots: { index: false, follow: true, googleBot: { index: false, follow: true } },
  twitter: { card: 'summary', title: 'Search Cards', description: 'Search DCM-graded trading cards by serial number. Find and verify grades for Sports Cards, Pokemon, Magic: The Gathering, Disney Lorcana, and more.', images: ['/DCM-logo.png'] },
  alternates: { canonical: 'https://dcmgrading.com/search' },
  title: 'Search Cards',
  description: 'Search DCM-graded trading cards by serial number. Find and verify grades for Sports Cards, Pokemon, Magic: The Gathering, Disney Lorcana, and more.',
  keywords: 'search graded cards, verify card grade, card lookup, serial number search, DCM graded cards',
  openGraph: {
    images: [{ url: '/DCM-logo.png', alt: 'DCM Grading' }],
    url: 'https://dcmgrading.com/search',
    title: 'Search DCM Graded Cards',
    description: 'Search and verify DCM-graded trading cards by serial number.',
    type: 'website',
  },
});

export default function SearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
