import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Yu-Gi-Oh! Card Database - Browse & Grade Cards',
  description: 'Browse the complete Yu-Gi-Oh! card database with 14,000+ cards. Find cards by set, type, attribute, or archetype. View card details and get instant AI grades for any Yu-Gi-Oh! card.',
  keywords: 'yugioh card database, yu-gi-oh cards, yugioh card search, yugioh TCG database, find yugioh cards, konami yugioh sets',
  openGraph: {
    title: 'Yu-Gi-Oh! Card Database | DCM Grading',
    description: 'Browse the complete Yu-Gi-Oh! card database. Find and grade any Yu-Gi-Oh! card.',
    type: 'website',
    siteName: 'DCM Grading',
  },
  twitter: {
    card: 'summary',
    title: 'Yu-Gi-Oh! Card Database',
    description: 'Browse and search the complete Yu-Gi-Oh! card database.',
  },
};

export default function YugiohDatabaseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
