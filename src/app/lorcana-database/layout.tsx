import { completeMetadata } from '@/lib/seo/completeMetadata'
import { Metadata } from 'next';

export const metadata: Metadata = completeMetadata({
  alternates: { canonical: 'https://dcmgrading.com/lorcana-database' },
  title: 'Disney Lorcana Card Database: Browse Cards',
  description: "Browse Disney Lorcana cards by set, character or ink type. View card details and explore photo-based condition grading with DCM Optic.",
  keywords: 'lorcana card database, disney lorcana cards, lorcana card search, lorcana TCG database, find lorcana cards, lorcana card sets',
  openGraph: {
    images: [{ url: '/DCM-logo.png', alt: 'DCM Grading' }],
    url: 'https://dcmgrading.com/lorcana-database',
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
});

export default function LorcanaDatabaseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
