import { redirect, notFound } from 'next/navigation';
import { supabaseServer } from '@/lib/supabaseServer';
import { withColumnFallback } from '@/lib/cards/ownership';
import { Metadata } from 'next';
import { categoryToRouteSlug } from '@/lib/postGradeEmailTemplates';

interface PageProps {
  params: Promise<{ serial: string }>;
}

// Canonical category -> route slug (case-insensitive, covers every category
// incl. Star Wars — the old local map silently sent those to /sports).
function getCardRoute(category: string | null, id: string): string {
  return `/${categoryToRouteSlug(category)}/${id}`;
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
      .select('id, category, org_id')
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

  // Org-graded cards land on the org's branded storefront page when one is
  // live — this retroactively brands every QR already printed on their slabs.
  const orgId = (card as { org_id?: string | null }).org_id;
  if (orgId) {
    const { data: org } = await supabase
      .from('organizations')
      .select('slug, status, storefront_enabled')
      .eq('id', orgId)
      .maybeSingle();
    if (org?.storefront_enabled && org.status === 'active') {
      redirect(`/enterprise/${org.slug}/card/${card.id}`);
    }
  }

  redirect(getCardRoute(card.category, card.id));
}
