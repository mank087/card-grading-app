import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Disney Lorcana Card Database - Browse & Grade Cards',
  description: 'Browse the complete Disney Lorcana card database. Find cards by set, character, or ink type. View card details and get instant AI grades for any Lorcana card.',
  keywords: 'lorcana card database, disney lorcana cards, lorcana card search, lorcana TCG database, find lorcana cards, lorcana card sets',
  openGraph: {
    title: 'Lorcana Card Database | DCM Grading',
    description: 'Browse the complete Disney Lorcana card database. Find and grade any Lorcana card.',
    type: 'website',
    siteName: 'DCM Grading',
  },
  twitter: {
    card: 'summary',
    title: 'Lorcana Card Database',
    description: 'Browse and search the complete Disney Lorcana card database.',
  },
};

export default function LorcanaDatabaseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
