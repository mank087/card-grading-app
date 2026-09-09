import { completeMetadata } from '@/lib/seo/completeMetadata'
import { Metadata } from 'next';

export const metadata: Metadata = completeMetadata({
  alternates: { canonical: 'https://dcmgrading.com/yugioh-database' },
  title: 'Yu-Gi-Oh! Card Database - Browse & Grade Cards',
  description: "Browse Yu-Gi-Oh! cards by set, type, attribute or archetype. View card details and explore DCM Optic grading from front and back photos.",
  keywords: 'yugioh card database, yu-gi-oh cards, yugioh card search, yugioh TCG database, find yugioh cards, konami yugioh sets',
  openGraph: {
    images: [{ url: '/DCM-logo.png', alt: 'DCM Grading' }],
    url: 'https://dcmgrading.com/yugioh-database',
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
});

export default function YugiohDatabaseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
