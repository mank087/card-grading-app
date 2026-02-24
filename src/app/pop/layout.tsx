import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Population Report | DCM Grading',
  description:
    'Explore DCM Grading\'s population report — see every card graded by category, set, and individual card with grade distributions. Track grading volume and rarity across Pokemon, MTG, Sports, Lorcana, One Piece, and more.',
  openGraph: {
    title: 'Population Report | DCM Grading',
    description:
      'See every card graded by DCM — broken down by category, set, and card with full grade distributions.',
    url: 'https://www.dcmgrading.com/pop',
    siteName: 'DCM Grading',
    type: 'website',
  },
};

export default function PopLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
