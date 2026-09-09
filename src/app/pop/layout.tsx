import { completeMetadata } from '@/lib/seo/completeMetadata'
import type { Metadata } from 'next';

export const metadata: Metadata = completeMetadata({
  twitter: { card: 'summary', title: 'Population Report', description: 'Explore DCM Grading\'s population report — see every card graded by category, set, and individual card with grade distributions. Track grading volume and rarity across Pokemon, MTG, Sports, Lorcana, One Piece, and more.', images: ['/DCM-logo.png'] },
  // Root layout appends " | DCM Grading" via its title template.
  title: 'Population Report',
  description:
    "Explore DCM’s population report by category, set and card. Compare grade distributions across Pokémon, sports, MTG, Lorcana, One Piece and more.",
  openGraph: {
    images: [{ url: '/DCM-logo.png', alt: 'DCM Grading' }],
    title: 'Population Report | DCM Grading',
    description:
      'See every card graded by DCM — broken down by category, set, and card with full grade distributions.',
    url: 'https://dcmgrading.com/pop',
    siteName: 'DCM Grading',
    type: 'website',
  },
  alternates: {
    canonical: 'https://dcmgrading.com/pop',
  },
});

export default function PopLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
