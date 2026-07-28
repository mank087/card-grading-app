// Shared interpretation of user_credits.preferred_label_emblem.
//
// The column has THREE distinct shapes in production:
//   'auto'            — the column DEFAULT, meaning "no explicit choice yet"
//   'none'            — user explicitly turned all emblems off
//   'founder,vip'     — explicit comma-separated selection (written by
//                       /api/user/label-emblem-preference)
//
// The label renderers used to parse this as a plain comma list, so the DEFAULT
// value 'auto' became ['auto'] and matched no emblem name — every founder /
// VIP / Card Lover who never opened the emblem picker (i.e. all of them, since
// 'auto' is the default) got a blank emblem slot on printed labels.

export interface EmblemOwnership {
  is_founder?: boolean | null;
  is_vip?: boolean | null;
  is_card_lover?: boolean | null;
  show_founder_badge?: boolean | null;
  show_vip_badge?: boolean | null;
  show_card_lover_badge?: boolean | null;
  preferred_label_emblem?: string | null;
}

export interface EmblemVisibility {
  showFounderEmblem: boolean;
  showVipEmblem: boolean;
  showCardLoversEmblem: boolean;
}

/**
 * Resolve which emblems to render for a card owner.
 *
 * 'auto' / null / '' → show every emblem the user owns (and hasn't hidden via
 * its individual show_*_badge flag). 'none' → show none. Anything else is
 * treated as an explicit comma-separated allow-list.
 */
export function resolveEmblemVisibility(row: EmblemOwnership | null | undefined): EmblemVisibility {
  if (!row) {
    return { showFounderEmblem: false, showVipEmblem: false, showCardLoversEmblem: false };
  }

  const raw = (row.preferred_label_emblem ?? '').trim().toLowerCase();
  const isUnset = raw === '' || raw === 'auto';
  const isNone = raw === 'none';
  const selected = isUnset || isNone
    ? []
    : raw.split(',').map(s => s.trim()).filter(Boolean);

  const allowed = (name: string) => (isUnset ? true : selected.includes(name));

  return {
    showFounderEmblem: !!row.is_founder && row.show_founder_badge !== false && allowed('founder'),
    showVipEmblem: !!row.is_vip && row.show_vip_badge !== false && allowed('vip'),
    showCardLoversEmblem: !!row.is_card_lover && row.show_card_lover_badge !== false && allowed('card_lover'),
  };
}
