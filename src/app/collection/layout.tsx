import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Collection - Graded Cards',
  description: 'View and manage your graded card collection. Access grades, download labels, share cards, and track your collection value with DCM Grading.',
  keywords: 'card collection, graded cards, my cards, card portfolio, grading history, card labels',
  openGraph: {
    title: 'My Card Collection | DCM Grading',
    description: 'View and manage your graded card collection. Download labels and share your cards.',
    type: 'website',
    siteName: 'DCM Grading',
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function CollectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
