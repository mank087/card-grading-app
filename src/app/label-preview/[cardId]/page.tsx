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
 *   &type=slab-modern|slab-traditional|slab-custom
 *   &side=front|back
 *   &customConfig=<base64-json>     — optional, used for slab-custom
 *
 * postMessage from RN host (data field):
 *   { type: 'preview-config', config: CustomLabelConfig, side: 'front'|'back' }
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
import { generateQRCodeWithLogo, loadLogoAsBase64, loadWhiteLogoAsBase64 } from '@/lib/foldableLabelGenerator';
import type { CustomLabelConfig } from '@/lib/labelPresets';
import type { SlabLabelData } from '@/lib/slabLabelGenerator';

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (data: string) => void };
  }
}

const PREVIEW_DPI = 144;

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
  const renderIdRef = useRef(0);

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
            const selected: string[] = (creditsRow.preferred_label_emblem || '')
              .split(',').map((s: string) => s.trim()).filter(Boolean);
            showFounderEmblem = !!creditsRow.is_founder && creditsRow.show_founder_badge !== false && selected.includes('founder');
            showVipEmblem = !!creditsRow.is_vip && creditsRow.show_vip_badge !== false && selected.includes('vip');
            showCardLoversEmblem = !!creditsRow.is_card_lover && creditsRow.show_card_lover_badge !== false && selected.includes('card_lover');
          }
        } catch { /* non-fatal */ }

        const labelData = getCardLabelData(card);
        const w = card.conversational_weighted_sub_scores || {};
        const s = card.conversational_sub_scores || {};
        const subScores = {
          centering: w.centering ?? s.centering?.weighted ?? 0,
          corners: w.corners ?? s.corners?.weighted ?? 0,
          edges: w.edges ?? s.edges?.weighted ?? 0,
          surface: w.surface ?? s.surface?.weighted ?? 0,
        };
        const grade = labelData.grade ?? 0;
        const cardUrl = `${window.location.origin}/verify/${card.serial}`;
        // Load BOTH the dark and white logos — the renderer picks logoDataUrl
        // for light/traditional themes, whiteLogoDataUrl for dark/modern/custom
        // themes (customSlabLabelGenerator.ts:611). Without the white one,
        // modern + custom slabs fall back to the "DCM" text logo.
        const [qrCodeDataUrl, logoDataUrl, whiteLogoDataUrl] = await Promise.all([
          generateQRCodeWithLogo(cardUrl).catch(() => ''),
          loadLogoAsBase64().catch(() => ''),
          loadWhiteLogoAsBase64().catch(() => ''),
        ]);

        if (cancelled) return;
        slabDataRef.current = {
          primaryName: labelData.primaryName,
          contextLine: labelData.contextLine || '',
          features: Array.isArray((labelData as any).features) ? (labelData as any).features : [],
          featuresLine: labelData.featuresLine || null,
          serial: labelData.serial,
          grade,
          gradeFormatted: grade % 1 === 0 ? String(grade) : grade.toFixed(1),
          condition: labelData.condition,
          isAlteredAuthentic: false,
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
    const renderId = ++renderIdRef.current;
    try {
      const data = slabDataRef.current;
      const side = (config.side as 'front' | 'back') || 'front';
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
