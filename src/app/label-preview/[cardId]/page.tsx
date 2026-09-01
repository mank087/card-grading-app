'use client';

/**
 * Label Preview page — loaded in a hidden mobile WebView (LabelWebRenderer).
 * Renders the slab label using the SAME canvas generators that power the
 * download PDFs (renderFrontCanvas / renderBackCanvas from
 * customSlabLabelGenerator), so the live mobile preview matches the
 * downloaded file exactly with zero drift.
 *
 * Initial config comes from URL query params; subsequent config updates
 * arrive via window.postMessage from the host RN code (LabelWebRenderer
 * uses injectJavaScript to dispatch them). On every render the page posts
 * a base64 PNG data URL back to RN via window.ReactNativeWebView.postMessage.
 *
 * URL params:
 *   ?token=<jwt>                    — Supabase auth token
 *   &type=slab-modern|slab-traditional|slab-custom|slab-heritage|
 *         onetouch-heritage|toploader-heritage|foldover-heritage
 *   &heritagePattern=<band pattern id>  — optional, heritage types only
 *   &side=front|back
 *   &customConfig=<base64-json>     — optional, used for slab-custom
 *
 * postMessage from RN host (data field):
 *   { type: 'preview-config', config: CustomLabelConfig, side: 'front'|'back',
 *     labelText?: { primaryName?, contextLine?, featuresLine?, condition? } }
 *   labelText is optional — when present it's merged over the fetched card
 *   data so live text edits in the mobile Label Studio reach the canvas.
 *
 * postMessage to RN host:
 *   { type: 'label-preview-ready', dataUrl: string, side: 'front'|'back' }
 *   { type: 'label-preview-error', message: string }
 */

import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { getCardLabelData } from '@/lib/useLabelData';
import { renderFrontCanvas, renderBackCanvas } from '@/lib/customSlabLabelGenerator';
import { generateQRCodeWithLogo, loadLogoAsBase64 } from '@/lib/foldableLabelGenerator';
import { loadLogosForCard } from '@/lib/orgBranding';
import type { OrgLabelDesign } from '@/lib/labels/orgLabelDesign';
import type { CustomLabelConfig } from '@/lib/labelPresets';
import type { SlabLabelData } from '@/lib/slabLabelGenerator';
import { resolveEmblemVisibility } from '@/lib/labelEmblems';

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (data: string) => void };
  }
}

const PREVIEW_DPI = 144;
/** Compact panels are physically tiny — render denser so 4pt type stays legible. */
const COMPACT_PREVIEW_DPI = 260;

/** Compact Heritage formats this page can render, keyed off the ?type param. */
type CompactFormat = 'onetouch' | 'toploader' | 'foldover';
function compactFormatFor(type: string): CompactFormat | null {
  if (type === 'onetouch-heritage') return 'onetouch';
  if (type === 'toploader-heritage') return 'toploader';
  if (type === 'foldover-heritage') return 'foldover';
  return null;
}

function postToRN(payload: any) {
  if (typeof window !== 'undefined' && window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify(payload));
  }
}

/** Modern dark slab preset → CustomLabelConfig */
function modernConfig(side: 'front' | 'back'): CustomLabelConfig {
  return {
    preset: 'dcm',
    width: 2.8,
    height: 0.8,
    colorPreset: 'modern-dark',
    gradientStart: '#1a1625',
    gradientEnd: '#2d1f47',
    style: 'modern',
    borderEnabled: false,
    borderColor: '#7c3aed',
    borderWidth: 0.04,
    side,
  };
}

/** Traditional light slab preset → CustomLabelConfig */
function traditionalConfig(side: 'front' | 'back'): CustomLabelConfig {
  return {
    preset: 'dcm-traditional',
    width: 2.8,
    height: 0.8,
    colorPreset: 'traditional',
    gradientStart: '#f9fafb',
    gradientEnd: '#ffffff',
    style: 'traditional',
    borderEnabled: false,
    borderColor: '#7c3aed',
    borderWidth: 0.04,
    side,
  };
}

/** Heritage preset → CustomLabelConfig (band colours resolve per card). */
function heritageConfig(side: 'front' | 'back', pattern?: string | null): CustomLabelConfig {
  return {
    ...traditionalConfig(side),
    preset: 'dcm-heritage',
    style: 'heritage',
    heritagePattern: pattern || 'diamond',
  };
}

/** DCM Bordered preset → CustomLabelConfig */
function borderedConfig(side: 'front' | 'back'): CustomLabelConfig {
  return {
    ...traditionalConfig(side),
    preset: 'dcm-bordered',
    borderEnabled: true,
    borderColor: '#7c3aed',
    borderWidth: 0.04,
  };
}

export default function LabelPreviewPage() {
  const { cardId } = useParams<{ cardId: string }>();
  const sp = useSearchParams();
  const token = sp.get('token') || '';
  const initialType = sp.get('type') || 'slab-modern';
  const initialSide = (sp.get('side') as 'front' | 'back') || 'front';
  const initialCustomConfigRaw = sp.get('customConfig');

  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const slabDataRef = useRef<SlabLabelData | null>(null);
  // Raw card row + verify URL, for the compact Heritage renderers.
  const cardRef = useRef<any>(null);
  const cardUrlRef = useRef<string>('');
  const cardColorsRef = useRef<any>(null);
  const renderIdRef = useRef(0);
  // Heritage branding: the QR-centre disc must stay the DCM mark (verification
  // anchor), so heritage renders swap only the front-label mark for org cards.
  const heritageLogosRef = useRef<{ dcmColor: string; logoBlack?: string; logoScale?: number; design?: OrgLabelDesign | null } | null>(null);

  // Decode initial config from URL if provided
  function decodeCustom(raw: string | null): CustomLabelConfig | null {
    if (!raw) return null;
    try {
      const json = atob(decodeURIComponent(raw));
      return JSON.parse(json) as CustomLabelConfig;
    } catch {
      return null;
    }
  }

  // Pick the right config given a `type` + optional override custom config
  function configFor(type: string, side: 'front' | 'back', custom?: CustomLabelConfig | null): CustomLabelConfig {
    if (type === 'slab-custom' && custom) {
      return { ...custom, side };
    }
    if (type === 'slab-traditional') return traditionalConfig(side);
    if (type === 'slab-heritage') return heritageConfig(side, sp.get('heritagePattern'));
    if (type === 'slab-bordered' || type === 'dcm-bordered') return borderedConfig(side);
    return modernConfig(side);
  }

  // ---------- Card data load (once) ----------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!cardId || !token) throw new Error('Missing cardId or token');

        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          { global: { headers: { Authorization: `Bearer ${token}` } } },
        );
        const { data: card, error: cardErr } = await supabase
          .from('cards')
          .select('*')
          .eq('id', cardId)
          .single();
        if (cardErr || !card) throw new Error(cardErr?.message || 'Card not found');

        // Emblems + saved styles
        let showFounderEmblem = false, showVipEmblem = false, showCardLoversEmblem = false;
        try {
          const { data: creditsRow } = await supabase
            .from('user_credits')
            .select('is_founder, is_vip, is_card_lover, show_founder_badge, show_vip_badge, show_card_lover_badge, preferred_label_emblem')
            .single();
          if (creditsRow) {
            const emblems = resolveEmblemVisibility(creditsRow);
            showFounderEmblem = emblems.showFounderEmblem;
            showVipEmblem = emblems.showVipEmblem;
            showCardLoversEmblem = emblems.showCardLoversEmblem;
          }
        } catch { /* non-fatal */ }

        cardColorsRef.current = card.card_colors || null;
        const labelData = getCardLabelData(card);
        const w = card.conversational_weighted_sub_scores || {};
        const s = card.conversational_sub_scores || {};
        // Extract numeric value from either flat number or nested
        // { weighted: number } format (matches LabelStudioClient.extractScore).
        const extractScore = (key: string): number => {
          const ws = w[key];
          if (typeof ws === 'number') return ws;
          if (ws && typeof ws === 'object' && typeof ws.weighted === 'number') return ws.weighted;
          const sr = s[key];
          if (typeof sr === 'number') return sr;
          if (sr && typeof sr === 'object' && typeof sr.weighted === 'number') return sr.weighted;
          return 0;
        };
        const subScores = {
          centering: extractScore('centering'),
          corners: extractScore('corners'),
          edges: extractScore('edges'),
          surface: extractScore('surface'),
        };
        const cardUrl = `${window.location.origin}/verify/${card.serial}`;
        cardRef.current = card;
        cardUrlRef.current = cardUrl;
        // BOTH the dark and white logos — the renderer picks logoDataUrl
        // for light/traditional themes, whiteLogoDataUrl for dark/modern/custom
        // themes (customSlabLabelGenerator.ts:611). Org-graded cards get the
        // store's logos; DCM otherwise (loadLogosForCard falls back per asset).
        const logos = await loadLogosForCard(cardId).catch(() => ({ color: '', white: '', black: '', mark: '', logoScale: 1, design: null, branding: null as any }));
        const qrCodeDataUrl = await generateQRCodeWithLogo(cardUrl, logos.branding ? logos.color : undefined).catch(() => '');
        const logoDataUrl = logos.color;
        const whiteLogoDataUrl = logos.white;
        // Org cards carry the store mark on BOTH the front and the QR disc.
        heritageLogosRef.current = {
          dcmColor: logos.color,
          logoBlack: logos.branding ? logos.mark : undefined,
          logoScale: logos.logoScale,
          design: logos.design,
        };

        if (cancelled) return;
        slabDataRef.current = {
          primaryName: labelData.primaryName,
          contextLine: labelData.contextLine || '',
          features: Array.isArray((labelData as any).features) ? (labelData as any).features : [],
          featuresLine: labelData.featuresLine || null,
          serial: labelData.serial,
          // Pass grade through as null for ungraded cards (the renderer shows
          // 'A'/'N/A' instead of a literal 0) and the real altered-authentic
          // flag — matches web Label Studio (LabelStudioClient.tsx).
          grade: labelData.grade,
          gradeFormatted: labelData.gradeFormatted,
          condition: labelData.condition,
          isAlteredAuthentic: labelData.isAlteredAuthentic,
          englishName: card.featured || card.pokemon_featured || undefined,
          qrCodeDataUrl,
          subScores,
          logoDataUrl,
          whiteLogoDataUrl,
          showFounderEmblem,
          showVipEmblem,
          showCardLoversEmblem,
        } as any;

        // Initial render with the URL-provided config
        const initialConfig = configFor(initialType, initialSide, decodeCustom(initialCustomConfigRaw));
        await doRender(initialConfig);
      } catch (err: any) {
        if (cancelled) return;
        const msg = err?.message || String(err);
        setError(msg);
        postToRN({ type: 'label-preview-error', message: msg });
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId, token]);

  // ---------- Render fn ----------
  async function doRender(config: CustomLabelConfig) {
    if (!slabDataRef.current) return;
    // The compact holders are fixed by the ?type param — a config update from
    // the host changes colours and pattern, never which panel we are drawing.
    const compactFormat = compactFormatFor(initialType);
    const renderId = ++renderIdRef.current;
    try {
      const data = slabDataRef.current;
      const side = (config.side as 'front' | 'back') || 'front';
      // Heritage Compact — the One-Touch / Toploader / fold-over panels. Same
      // canvas functions the print sheets use, so the mobile preview cannot
      // drift from the paper (the slab rasterizer below cannot draw these).
      if (compactFormat) {
        const [{ buildHeritageCompactInputs, loadWordmarkDataUrl, compactQrDataUrl }, compact, { resolveHeritageSelection }] =
          await Promise.all([
            import('@/lib/labels/heritageCompactInputs'),
            import('@/lib/labels/heritageCompact'),
            import('@/lib/labels/labelStyleResolution'),
          ]);
        const sel = resolveHeritageSelection('heritage', config);
        const inputs = buildHeritageCompactInputs(cardRef.current, {
          qrDataUrl: await compactQrDataUrl(cardUrlRef.current || ''),
          bandColors: sel.bandColors ?? null,
          pattern: sel.pattern,
          wordmarkDataUrl: await loadWordmarkDataUrl(),
          chipTheme: heritageLogosRef.current?.design?.chip.theme,
          textTransform: heritageLogosRef.current?.design?.text.transform,
        });
        const fn =
          compactFormat === 'onetouch' ? (side === 'front' ? compact.renderOneTouchFront : compact.renderOneTouchBack)
          : compactFormat === 'toploader' ? (side === 'front' ? compact.renderToploaderFront : compact.renderToploaderBack)
          : (side === 'front' ? compact.renderFoldFront : compact.renderFoldBack);
        const canvas = await fn(inputs, COMPACT_PREVIEW_DPI);
        if (renderId !== renderIdRef.current) return;
        const url = canvas.toDataURL('image/png');
        setImageUrl(url);
        postToRN({ type: 'label-preview-ready', dataUrl: url, side });
        return;
      }
      // Heritage renders through the shared SVG rasterizer (the canvas
      // generators only know modern/traditional layouts).
      if (config.style === 'heritage') {
        const [{ renderHeritageLabelPng }, { resolveHeritageSelection }, { resolveHeritageBandColors }] = await Promise.all([
          import('@/lib/labels/heritageRaster'),
          import('@/lib/labels/labelStyleResolution'),
          import('@/lib/labelLab/heritageLayout'),
        ]);
        const sel = resolveHeritageSelection('heritage', config);
        const hb = heritageLogosRef.current;
        const url = await renderHeritageLabelPng({
          // Heritage QR disc reads data.logoDataUrl (org colour for org cards).
          data: (hb ? { ...(data as any), logoDataUrl: hb.dcmColor || (data as any).logoDataUrl } : data) as any,
          logoBlack: hb?.logoBlack,
          logoScale: hb?.logoScale ?? 1,
          design: hb?.design ?? null,
          side,
          pattern: sel.pattern,
          bandColors: sel.bandColors ?? resolveHeritageBandColors(cardColorsRef.current),
          gradeColors: sel.gradeColors,
          widthPx: 806,
        });
        if (renderId !== renderIdRef.current) return;
        setImageUrl(url);
        postToRN({ type: 'label-preview-ready', dataUrl: url, side });
        return;
      }
      const canvas = side === 'front'
        ? await renderFrontCanvas(data as any, config, PREVIEW_DPI)
        : await renderBackCanvas(data as any, config, PREVIEW_DPI);
      if (renderId !== renderIdRef.current) return;
      const url = canvas.toDataURL('image/png');
      setImageUrl(url);
      postToRN({ type: 'label-preview-ready', dataUrl: url, side });
    } catch (err: any) {
      if (renderId !== renderIdRef.current) return;
      const msg = err?.message || String(err);
      setError(msg);
      postToRN({ type: 'label-preview-error', message: msg });
    }
  }

  // ---------- Listen for config updates from RN host ----------
  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      const data = (ev as any).data;
      let parsed: any = data;
      if (typeof data === 'string') {
        try { parsed = JSON.parse(data); } catch { return; }
      }
      if (!parsed || parsed.type !== 'preview-config') return;
      const cfg = parsed.config as CustomLabelConfig | undefined;
      const sideOverride = parsed.side as 'front' | 'back' | undefined;
      if (!cfg) return;
      // Optional emblem override piped from the RN host's EmblemsContext.
      // When the user toggles a badge in the mobile picker we receive a
      // new config message with updated emblem flags; mutate the cached
      // slab data so the next canvas render reflects them. Without this,
      // the preview kept using the snapshot loaded once on mount.
      const e = parsed.emblems as { showFounderEmblem?: boolean; showVipEmblem?: boolean; showCardLoversEmblem?: boolean } | undefined;
      if (e && slabDataRef.current) {
        (slabDataRef.current as any).showFounderEmblem = !!e.showFounderEmblem;
        (slabDataRef.current as any).showVipEmblem = !!e.showVipEmblem;
        (slabDataRef.current as any).showCardLoversEmblem = !!e.showCardLoversEmblem;
      }
      // Optional live label-text override from the RN host. Card data is
      // fetched once and cached in slabDataRef, so without this the canvas
      // never reflects text edits made in the mobile Label Text section.
      // Messages without labelText behave exactly as before (backward compat).
      const lt = parsed.labelText as {
        primaryName?: string;
        contextLine?: string;
        featuresLine?: string | null;
        condition?: string;
      } | undefined;
      if (lt && slabDataRef.current) {
        const d = slabDataRef.current as any;
        if (typeof lt.primaryName === 'string') d.primaryName = lt.primaryName;
        if (typeof lt.contextLine === 'string') d.contextLine = lt.contextLine;
        if (lt.featuresLine !== undefined) {
          d.featuresLine = lt.featuresLine || null;
          d.features = (lt.featuresLine || '')
            .split(/[•,]/).map((f: string) => f.trim()).filter(Boolean);
        }
        if (typeof lt.condition === 'string') d.condition = lt.condition;
      }
      doRender({ ...cfg, side: sideOverride || cfg.side || 'front' });
    }
    window.addEventListener('message', onMessage);
    document.addEventListener('message' as any, onMessage as any);
    return () => {
      window.removeEventListener('message', onMessage);
      document.removeEventListener('message' as any, onMessage as any);
    };
  }, []);

  return (
    <div style={{ margin: 0, padding: 0, background: 'transparent' }}>
      {imageUrl ? (
        <img src={imageUrl} alt="" style={{ width: '100%', display: 'block' }} />
      ) : (
        <div style={{ padding: 16, color: '#6b7280', fontFamily: 'system-ui' }}>
          {error ? `Error: ${error}` : 'Rendering preview…'}
        </div>
      )}
    </div>
  );
}
