import { redirect, notFound } from 'next/navigation';
import { supabaseServer } from '@/lib/supabaseServer';
import { Metadata } from 'next';

interface PageProps {
  params: Promise<{ serial: string }>;
}

const SPORT_CATEGORIES = ['Football', 'Baseball', 'Basketball', 'Hockey', 'Soccer', 'Wrestling', 'Sports'];

function getCardRoute(category: string | null, id: string): string {
  if (category && SPORT_CATEGORIES.includes(category)) return `/sports/${id}`;
  if (category === 'Pokemon') return `/pokemon/${id}`;
  if (category === 'MTG') return `/mtg/${id}`;
  if (category === 'Lorcana') return `/lorcana/${id}`;
  if (category === 'One Piece') return `/onepiece/${id}`;
  if (category === 'Yu-Gi-Oh') return `/yugioh/${id}`;
  if (category === 'Star Wars') return `/starwars/${id}`;
  if (category === 'Other') return `/other/${id}`;
  // Fallback — try sports as default since it was the original card type
  return `/sports/${id}`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { serial } = await params;
  return {
    title: `DCM Grading — Verify ${serial}`,
    description: `Verify graded card ${serial} on DCM Grading`,
  };
}

export default async function VerifyPage({ params }: PageProps) {
  const { serial } = await params;

  const supabase = supabaseServer();
  const { data: card } = await supabase
    .from('cards')
    .select('id, category')
    .eq('serial', serial)
    .single();

  if (!card) {
    notFound();
  }

  redirect(getCardRoute(card.category, card.id));
}
