import { completeMetadata } from '@/lib/seo/completeMetadata'
import { Metadata } from 'next';

export const metadata: Metadata = completeMetadata({
  alternates: { canonical: 'https://dcmgrading.com/onepiece-database' },
  title: 'One Piece Card Database - Browse & Grade Cards',
  description: "Browse One Piece cards by set, character or type. Explore card details and get a DCM Optic condition report from front and back photos.",
  keywords: 'one piece card database, one piece TCG cards, one piece card search, one piece card game database, find one piece cards',
  openGraph: {
    images: [{ url: '/DCM-logo.png', alt: 'DCM Grading' }],
    url: 'https://dcmgrading.com/onepiece-database',
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
});

export default function OnePieceDatabaseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
