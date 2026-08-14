import { createClient } from '@supabase/supabase-js';
import type { Organization } from '@/lib/organizations';

/** Storefront content blob shape (organizations.storefront jsonb). */
export interface StorefrontContent {
  tagline?: string;
  description?: string;
  address?: string;
  phone?: string;
  public_email?: string;
  website?: string;
  hours?: string;
  /** Registered/legal business name for the copyright line (falls back to org.name). */
  legal_name?: string;
  /** Which logo variant the hero shows. Default 'color' (on a light chip). */
  hero_logo?: 'color' | 'white' | 'none';
  /** How store photos render: 'crop' fills the tile, 'fit' shows the whole image. */
  photo_display?: 'crop' | 'fit';
  /** Show the "recently graded" strip on the storefront home (default off). */
  show_recent_cards?: boolean;
  socials?: Partial<Record<'instagram' | 'facebook' | 'tiktok' | 'youtube' | 'x', string>>;
  /**
   * "How it works" steps and FAQ entries. Undefined = render the shared
   * defaults (src/lib/storefrontDefaults.ts); an explicit empty array hides
   * the section entirely.
   */
  how_it_works?: { title: string; body: string }[];
  faqs?: { q: string; a: string }[];
  /** About-section heading + check bullets. Undefined = shared defaults; empty bullets array hides the list. */
  about_title?: string;
  about_bullets?: string[];
  /** Storage paths inside org-assets ({orgId}/store/...). */
  photos?: string[];
  /**
   * Slab/label design. 1–5 colors; a single color renders solid. label_style
   * is the org's house style: it drives the storefront mockup AND which label
   * the public card report renders (heritage uses pattern + colors).
   */
  slab?: { pattern?: string; colors?: string[]; label_style?: 'modern' | 'heritage'; color_source?: 'brand' | 'card' };
}

export interface StorefrontData {
  org: Organization;
  content: StorefrontContent;
  logos: { color: string | null; white: string | null };
  photoUrls: string[];
  /** 10 most recent public org-graded cards, only when show_recent_cards. */
  recentCards: { card: Record<string, unknown>; frontUrl: string | null }[];
}

function service() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * The org's brand palette (1–5 colors): brand_colors, falling back to the
 * single legacy brand_color, then DCM purple. This — not the DCM set — is
 * what "brand default" means anywhere on an org's pages.
 */
export function orgBrandPalette(org: Pick<Organization, 'brand_colors' | 'brand_color'>): string[] {
  const set = (org.brand_colors || []).filter(c => HEX_RE.test(c)).slice(0, 5);
  if (set.length) return set;
  if (org.brand_color && HEX_RE.test(org.brand_color)) return [org.brand_color];
  return ['#7C3AED'];
}

const SIGN_TTL = 60 * 60;

/** Load an enabled storefront by slug; null hides disabled/unknown orgs. */
export async function getStorefront(slug: string): Promise<StorefrontData | null> {
  const s = service();
  const { data: org } = await s
    .from('organizations')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle();
  if (!org || !(org as any).storefront_enabled) return null;

  const content: StorefrontContent = ((org as any).storefront as StorefrontContent) || {};
  const sign = async (path: string | null | undefined): Promise<string | null> => {
    if (!path) return null;
    const { data } = await s.storage.from('org-assets').createSignedUrl(path, SIGN_TTL);
    return data?.signedUrl ?? null;
  };

  const [color, white, ...photos] = await Promise.all([
    sign(org.logo_path),
    sign(org.logo_white_path),
    ...(content.photos || []).slice(0, 8).map(p => sign(p)),
  ]);

  // Optional "recently graded" strip: 10 newest public org cards, light
  // label columns only, front images signed from the cards bucket.
  let recentCards: StorefrontData['recentCards'] = [];
  if (content.show_recent_cards) {
    const { data: cards } = await s
      .from('cards')
      .select('id, serial, org_serial_display, category, front_path, created_at, ' +
        'conversational_card_info, conversational_whole_grade, conversational_decimal_grade, ' +
        'conversational_condition_label, label_data, custom_label_data, card_colors, ' +
        'card_name, card_set, card_number, featured, pokemon_featured')
      .eq('org_id', org.id)
      .eq('is_public', true)
      .is('deleted_at', null)
      .not('conversational_whole_grade', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10);
    recentCards = await Promise.all(
      ((cards as any[]) ?? []).map(async c => ({
        card: c as Record<string, unknown>,
        frontUrl: c.front_path
          ? (await s.storage.from('cards').createSignedUrl(c.front_path, SIGN_TTL)).data?.signedUrl ?? null
          : null,
      }))
    );
  }

  return {
    org: org as Organization,
    content,
    logos: { color, white },
    photoUrls: photos.filter(Boolean) as string[],
    recentCards,
  };
}

/**
 * Public serial lookup, scoped to this org's publicly-visible cards.
 *
 * Accepts the org serial in any reasonable form — "MFG-000042", "mfg 42",
 * "000042", "42" — and falls back to the global DCM serial (the number in
 * pre-org-serial QR codes) so older slabs keep resolving.
 */
export async function lookupOrgSerial(slug: string, serial: string): Promise<{ id: string } | null> {
  const raw = serial.trim();
  if (!raw || raw.length > 24 || !/^[a-z0-9\s-]+$/i.test(raw)) return null;
  const s = service();
  const { data: org } = await s.from('organizations').select('id, storefront_enabled, status').eq('slug', slug).maybeSingle();
  if (!org || !(org as any).storefront_enabled || org.status !== 'active') return null;

  const find = async (column: 'org_serial' | 'serial', value: number | string) => {
    const { data } = await s.from('cards').select('id')
      .eq('org_id', org.id)
      .eq('is_public', true)
      .is('deleted_at', null)
      .eq(column, value)
      .maybeSingle();
    return data ? { id: data.id as string } : null;
  };

  // Org serial: trailing digit run (with or without a prefix), zero-stripped
  const m = raw.match(/(\d{1,10})\s*$/);
  if (m) {
    const n = parseInt(m[1], 10);
    if (Number.isFinite(n) && n > 0) {
      const hit = await find('org_serial', n);
      if (hit) return hit;
    }
  }
  // DCM serial fallback (digits only, as printed pre-org-serials)
  if (/^\d{4,10}$/.test(raw)) return find('serial', raw);
  return null;
}
