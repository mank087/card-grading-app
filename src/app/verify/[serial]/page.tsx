import { redirect, notFound } from 'next/navigation';
import { supabaseServer } from '@/lib/supabaseServer';
import { withColumnFallback } from '@/lib/cards/ownership';
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
  // Soft-deleted cards are treated as gone here. A SOLD card is deliberately
  // NOT excluded — this route is the QR target printed on the slab, and
  // keeping it resolving after a sale is the whole point of the ownership
  // lifecycle (see supabase/migrations/20260730_add_card_ownership_status.sql).
  // This route is the QR target printed on every slab, so it gets the
  // pre-migration fallback: a schema without deleted_at must not turn every
  // printed label into a 404.
  const { data: card } = await withColumnFallback(
    () => supabase
      .from('cards')
      .select('id, category')
      .eq('serial', serial)
      .is('deleted_at', null)
      .maybeSingle(),
    () => supabase
      .from('cards')
      .select('id, category')
      .eq('serial', serial)
      .maybeSingle(),
    `verify/${serial}`
  );

  if (!card) {
    notFound();
  }

  redirect(getCardRoute(card.category, card.id));
}
