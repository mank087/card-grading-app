import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'MTG Card Database - Browse & Grade Magic Cards',
  description: 'Browse the complete Magic: The Gathering card database. Find cards by set, name, or type. View card details and get instant AI grades for any MTG card.',
  keywords: 'MTG card database, magic the gathering cards, MTG card search, magic card database, find MTG cards, magic card sets',
  openGraph: {
    title: 'MTG Card Database | DCM Grading',
    description: 'Browse the complete Magic: The Gathering card database. Find and grade any MTG card.',
    type: 'website',
    siteName: 'DCM Grading',
  },
  twitter: {
    card: 'summary',
    title: 'MTG Card Database',
    description: 'Browse and search the complete Magic: The Gathering card database.',
  },
};

export default function MtgDatabaseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
