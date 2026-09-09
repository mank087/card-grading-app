import { completeMetadata } from '@/lib/seo/completeMetadata'
import { Metadata } from 'next';

export const metadata: Metadata = completeMetadata({
  alternates: { canonical: 'https://dcmgrading.com/pokemon-database' },
  title: 'Pokemon Card Database - Browse & Grade Cards',
  description: 'Browse the complete Pokemon card database. Find cards by set, name, or type. View card details and get instant DCM Optic™ grades for any Pokemon card.',
  keywords: 'pokemon card database, pokemon cards list, pokemon card search, pokemon TCG database, find pokemon cards, pokemon card sets',
  openGraph: {
    images: [{ url: '/DCM-logo.png', alt: 'DCM Grading' }],
    url: 'https://dcmgrading.com/pokemon-database',
    title: 'Pokemon Card Database | DCM Grading',
    description: 'Browse the complete Pokemon card database. Find and grade any Pokemon card.',
    type: 'website',
    siteName: 'DCM Grading',
  },
  twitter: {
    card: 'summary',
    title: 'Pokemon Card Database',
    description: 'Browse and search the complete Pokemon card database.',
  },
});

export default function PokemonDatabaseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
