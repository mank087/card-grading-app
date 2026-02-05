import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'One Piece Card Database - Browse & Grade Cards',
  description: 'Browse the complete One Piece card game database. Find cards by set, character, or type. View card details and get instant AI grades for any One Piece card.',
  keywords: 'one piece card database, one piece TCG cards, one piece card search, one piece card game database, find one piece cards',
  openGraph: {
    title: 'One Piece Card Database | DCM Grading',
    description: 'Browse the complete One Piece card game database. Find and grade any One Piece card.',
    type: 'website',
    siteName: 'DCM Grading',
  },
  twitter: {
    card: 'summary',
    title: 'One Piece Card Database',
    description: 'Browse and search the complete One Piece card game database.',
  },
};

export default function OnePieceDatabaseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
