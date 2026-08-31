import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { getStorefront } from '../../data';
import { getLabelData } from '@/lib/labelDataGenerator';
import { orgBrandPalette } from '../../data';
import { resolveHeritageBandColors } from '@/lib/labelLab/heritageLayout';
import { resolveOrgLabelDesign } from '@/lib/labels/orgLabelDesign';
import OrgCardReport, { type OrgReportCard } from './OrgCardReport';

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { title: 'Not found', robots: { index: false, follow: false } };
  const sf = await getStorefront(slug);
  if (!sf) return { title: 'Not found', robots: { index: false, follow: false } };

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  // select('*') like the page body — hand-picking columns here silently 404'd
  // the metadata when one name drifted from the schema.
  const { data: card } = await supabase
    .from('cards')
    .select('*')
    .eq('id', id)
    .eq('org_id', sf.org.id)
    // Live privacy field is cards.visibility (null = public on old rows);
    // is_public is dead — stuck at true since the Oct 2025 migration.
    .or('visibility.is.null,visibility.neq.private')
    .is('deleted_at', null)
    .maybeSingle();
  if (!card) return { title: 'Not found', robots: { index: false, follow: false } };

  const label = getLabelData(card as any);
  const grade = label.gradeFormatted;
  const serial = (card as any).org_serial_display || card.serial;
  const title = `${label.primaryName} — Graded ${grade} ${label.condition} | ${sf.org.name}`;
  const description = `${label.primaryName}${label.contextLine ? ` (${label.contextLine})` : ''} professionally graded ${grade}/10 ${label.condition} by ${sf.org.name}. Serial ${serial}. View the verified grading report with sub-scores and condition analysis.`;
  const canonical = `https://dcmgrading.com/enterprise/${slug}/card/${card.id}`;

  // OG image: short-lived signed URL is fine here (crawlers fetch at parse time).
  let ogImage: string | undefined;
  if ((card as any).front_path) {
    const { data: signed } = await supabase.storage.from('cards').createSignedUrl((card as any).front_path, 60 * 60);
    ogImage = signed?.signedUrl ?? undefined;
  }

  return {
    title: { absolute: title },
    description,
    keywords: [label.primaryName, sf.org.name, 'graded card', `grade ${grade}`, label.condition, 'card grading'],
    icons: {
      icon: [{ url: `/enterprise/${slug}/favicon`, type: 'image/png' }],
      shortcut: `/enterprise/${slug}/favicon`,
      apple: [{ url: `/enterprise/${slug}/favicon` }],
    },
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: sf.org.name,
      type: 'website',
      images: ogImage ? [{ url: ogImage, width: 800, height: 1120, alt: `${label.primaryName} — graded ${grade}` }] : undefined,
    },
    twitter: { card: ogImage ? 'summary_large_image' : 'summary', title, description },
  };
}

/**
 * Public org-branded grading report. Server component fetches the card row +
 * signs image URLs; OrgCardReport renders the full de-branded report for a
 * logged-out visitor.
 */
export default async function StorefrontCardPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const sf = await getStorefront(slug);
  if (!sf) notFound();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  // Single-row fetch; the report reads a couple dozen conversational_* fields,
  // so select the whole row and pass down only the public slice below.
  const { data: cardRow } = await supabase
    .from('cards')
    .select('*')
    .eq('id', id)
    .eq('org_id', sf.org.id)
    // visibility, not the dead is_public column; only explicit 'private' hides
    .or('visibility.is.null,visibility.neq.private')
    .is('deleted_at', null)
    .maybeSingle();
  if (!cardRow) notFound();
  const card = cardRow as any;

  // Images live as storage paths in the "cards" bucket — sign them here.
  const sign = async (path: string | null): Promise<string | null> => {
    if (!path) return null;
    const { data } = await supabase.storage.from('cards').createSignedUrl(path, 60 * 60);
    return data?.signedUrl ?? null;
  };
  const [frontUrl, backUrl] = await Promise.all([sign(card.front_path), sign(card.back_path)]);

  const label = getLabelData(card);
  // Serial display helper: the org-serial work stream will swap what is shown
  // here (cards.org_serial + org prefix) — keep it a single expression.
  const displaySerial: string = card.org_serial_display || card.serial || label.serial;

  const gradedOn = card.created_at
    ? new Date(card.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;
  const brand = sf.org.brand_color || '#7C3AED';

  // Org house label style (StorefrontContent.slab). Heritage uses the org's
  // band design; a single admin-picked color duplicates to two stops (the
  // heritage renderer expects >= 2), none falls back to the default band set —
  // same resolution as the storefront homepage mockup.
  const slabContent = sf.content.slab || {};
  // Heritage is the default house style for orgs that never chose one.
  const labelStyle: 'modern' | 'heritage' = slabContent.label_style === 'modern' ? 'modern' : 'heritage';
  const picked = (slabContent.colors || []).filter(Boolean);
  // Band color resolution: custom colors win; else color_source 'card' uses
  // THIS card's artwork colors; else the ORG's brand palette (never DCM's).
  const brandSet = orgBrandPalette(sf.org);
  const cardSet = slabContent.color_source === 'card' && picked.length === 0
    ? resolveHeritageBandColors((card as any).card_colors)
    : null;
  const heritageBandColors =
    picked.length >= 2 ? picked.slice(0, 5)
    : picked.length === 1 ? [picked[0], picked[0]]
    : cardSet && cardSet.length >= 2 ? cardSet
    : brandSet.length >= 2 ? brandSet
    : [brandSet[0], brandSet[0]];
  const heritagePattern = slabContent.pattern || 'diamond';

  // Only the public slice of the row crosses to the client — no user_id, no
  // owner/billing fields.
  const reportCard: OrgReportCard = {
    id: card.id,
    category: card.category ?? null,
    // Download builders (report PDF / mini report / card images) read these —
    // all public-safe, already shown on the page or printed on labels.
    serial: card.serial ?? null,
    org_id: card.org_id ?? null,
    org_serial: card.org_serial ?? null,
    org_serial_display: card.org_serial_display ?? null,
    created_at: card.created_at ?? null,
    conversational_decimal_grade: card.conversational_decimal_grade ?? null,
    conversational_whole_grade: card.conversational_whole_grade ?? null,
    conversational_condition_label: card.conversational_condition_label ?? null,
    conversational_final_grade_summary: card.conversational_final_grade_summary ?? null,
    conversational_grade_uncertainty: card.conversational_grade_uncertainty ?? null,
    estimated_professional_grades: card.estimated_professional_grades ?? null,
    dvg_decimal_grade: card.dvg_decimal_grade ?? null,
    pokemon_featured: card.pokemon_featured ?? null,
    sport: card.sport ?? null,
    rookie_card: card.rookie_card ?? null,
    autograph_type: card.autograph_type ?? null,
    serial_numbering: card.serial_numbering ?? null,
    is_foil: card.is_foil ?? null,
    foil_type: card.foil_type ?? null,
    is_double_faced: card.is_double_faced ?? null,
    mtg_rarity: card.mtg_rarity ?? null,
    conversational_card_info: card.conversational_card_info ?? null,
    conversational_sub_scores: card.conversational_sub_scores ?? null,
    conversational_weighted_sub_scores: card.conversational_weighted_sub_scores ?? null,
    conversational_corners_edges_surface: card.conversational_corners_edges_surface ?? null,
    conversational_centering_ratios: card.conversational_centering_ratios ?? null,
    conversational_grading: card.conversational_grading ?? null,
    conversational_image_confidence: card.conversational_image_confidence ?? null,
    conversational_case_detection: card.conversational_case_detection ?? null,
    conversational_slab_detection: card.conversational_slab_detection ?? null,
    slab_detected: card.slab_detected ?? null,
    card_name: card.card_name ?? null,
    card_set: card.card_set ?? null,
    featured: card.featured ?? null,
    release_date: card.release_date ?? null,
    manufacturer_name: card.manufacturer_name ?? null,
    card_number: card.card_number ?? null,
    subset: card.subset ?? null,
    dcm_price_estimate: card.dcm_price_estimate ?? null,
    dcm_price_raw: card.dcm_price_raw ?? null,
    dcm_price_graded_high: card.dcm_price_graded_high ?? null,
    dcm_price_median: card.dcm_price_median ?? null,
    dcm_price_average: card.dcm_price_average ?? null,
    dcm_price_match_confidence: card.dcm_price_match_confidence ?? null,
    dcm_price_product_name: card.dcm_price_product_name ?? null,
    dcm_price_updated_at: card.dcm_price_updated_at ?? null,
    // Full cached pricing payload — powers the per-grade tables, price range,
    // chart, and the exact product URL. Public-safe: market data only.
    dcm_cached_prices: card.dcm_cached_prices ?? null,
    dcm_prices_cached_at: card.dcm_prices_cached_at ?? null,
    scryfall_id: card.scryfall_id ?? null,
    has_user_condition_report: card.has_user_condition_report ?? null,
    user_condition_report: card.user_condition_report ?? null,
    user_condition_ai_response: card.user_condition_ai_response ?? null,
    user_report_influenced_grade: card.user_report_influenced_grade ?? null,
  };

  return (
    <OrgCardReport
      slug={slug}
      orgName={sf.org.name}
      brand={brand}
      logos={sf.logos}
      logoScale={sf.content.slab?.logo_scale || 1}
      frontUrl={frontUrl}
      backUrl={backUrl}
      label={label}
      displaySerial={displaySerial}
      gradedOn={gradedOn}
      card={reportCard}
      labelStyle={labelStyle}
      heritagePattern={heritagePattern}
      heritageBandColors={heritageBandColors}
      design={resolveOrgLabelDesign(sf.content)}
    />
  );
}
