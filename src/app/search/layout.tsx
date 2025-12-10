import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Search Cards',
  description: 'Search DCM-graded trading cards by serial number. Find and verify grades for Sports Cards, Pokemon, Magic: The Gathering, Disney Lorcana, and more.',
  keywords: 'search graded cards, verify card grade, card lookup, serial number search, DCM graded cards',
  openGraph: {
    title: 'Search DCM Graded Cards',
    description: 'Search and verify DCM-graded trading cards by serial number.',
    type: 'website',
  },
};

export default function SearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
