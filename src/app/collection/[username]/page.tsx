import type { Metadata } from 'next'
import SharedCollectionClient from './SharedCollectionClient'

interface Props {
  params: Promise<{ username: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params
  return {
    title: `${username}'s Collection | DCM Grading`,
    description: `View ${username}'s DCM Optic™ graded trading card collection on DCM Grading. Browse grades, sub-scores, and condition analysis for Pokemon, Sports, MTG, Lorcana, and One Piece cards.`,
    openGraph: {
      title: `${username}'s Collection | DCM Grading`,
      description: `View ${username}'s DCM Optic™ graded trading card collection with detailed condition analysis and sub-scores.`,
      type: 'website',
      siteName: 'DCM Grading',
      url: `https://dcmgrading.com/collection/${username}`,
      images: [{ url: '/DCM-logo.png', width: 512, height: 512, alt: 'DCM Grading' }],
    },
    robots: { index: true, follow: true },
  }
}

export default async function SharedCollectionPage({ params }: Props) {
  const { username } = await params
  return <SharedCollectionClient username={username} />
}
