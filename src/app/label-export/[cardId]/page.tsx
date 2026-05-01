'use client';

/**
 * Label Export page — loaded in a hidden WebView from the mobile card detail page.
 *
 * Generates a label/image artifact based on ?type query param, posts it back as
 * one or more base64 data URLs via window.ReactNativeWebView.postMessage.
 *
 * Supported types (mirrors LABEL_TYPES on the web):
 *   slab-modern, slab-traditional       — slab labels (PDF), format=duplex|foldover
 *   onetouch                            — Avery 6871 magnetic one-touch (PDF)
 *   toploader                           — Avery 8167 front+back pair (PDF)
 *   foldover                            — Avery 8167 foldover (PDF)
 *   card-image-modern, card-image-trad  — slab-overlaid card images (JPG x2)
 *   mini-report                         — DCM mini grading report (JPG)
 */

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { getCardLabelData } from '@/lib/useLabelData';
import { generateCardImages, type CardImageData } from '@/lib/cardImageGenerator';
import { generateMiniReportJpg } from '@/lib/miniReportJpgGenerator';
import { generateQRCodeWithLogo, loadLogoAsBase64, type FoldableLabelData } from '@/lib/foldableLabelGenerator';
import { generateAveryLabel } from '@/lib/averyLabelGenerator';
import { generateToploaderLabelPair, generateFoldOverLabel8167 } from '@/lib/avery8167LabelGenerator';
import { generateSlabLabel, generateFoldOverSlabLabel } from '@/lib/slabLabelGenerator';

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (data: string) => void };
  }
}

function postToRN(payload: any) {
  const msg = JSON.stringify(payload);
  if (typeof window !== 'undefined' && window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(msg);
  }
  console.log('[label-export]', msg.slice(0, 160));
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

function sanitize(text: string): string {
  return text.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-').slice(0, 60) || 'card';
}

export default function LabelExportPage() {
  const { cardId } = useParams<{ cardId: string }>();
  const sp = useSearchParams();
  const token = sp.get('token') || '';
  const type = sp.get('type') || 'slab-modern';
  const format = (sp.get('format') as 'duplex' | 'foldover') || 'duplex';
  const labelStyleParam = (sp.get('labelStyle') || 'modern') as 'modern' | 'traditional';
  // Avery sheet position (0-based). Defaults to 0 if not provided.
  const position = Math.max(0, parseInt(sp.get('position') || '0', 10) || 0);
  const secondPosition = Math.max(0, parseInt(sp.get('position2') || String(position + 1), 10) || (position + 1));
  const [status, setStatus] = useState('Initializing…');
  const [error, setError] = useState<string | null>(null);

  // Wraps setStatus + posts back to RN so mobile can show progress
  const postStatus = (s: string) => {
    setStatus(s);
    postToRN({ type: 'status', message: s });
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!cardId || !token) throw new Error('Missing cardId or token');
        postStatus('Loading card…');
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

        const paths = [card.front_path, card.back_path].filter(Boolean) as string[];
        const { data: signed } = await supabase.storage.from('cards').createSignedUrls(paths, 3600);
        const frontImageUrl = signed?.find(u => u.path === card.front_path)?.signedUrl || '';
        const backImageUrl = signed?.find(u => u.path === card.back_path)?.signedUrl || '';

        // Look up the user's emblem entitlements + selections (same logic as the
        // mobile useUserEmblems hook). Mirrors web parity so labels carry Founder /
        // VIP / Card Lover badges when the user has them enabled.
        let showFounderEmblem = false;
        let showVipEmblem = false;
        let showCardLoversEmblem = false;
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
        } catch (e) {
          console.warn('[label-export] emblem lookup failed (non-fatal):', e);
        }

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
        const namePrefix = sanitize(labelData.primaryName || `card-${card.serial}`);

        const blobs: Array<{ name: string; mime: string; dataUrl: string }> = [];

        if (type === 'card-image-modern' || type === 'card-image-traditional') {
          postStatus('Generating slab card images…');
          const imageData: CardImageData = {
            cardName: labelData.primaryName,
            contextLine: labelData.contextLine,
            specialFeatures: labelData.featuresLine || undefined,
            serial: labelData.serial,
            englishName: card.featured || card.pokemon_featured || undefined,
            grade,
            conditionLabel: labelData.condition,
            cardUrl,
            frontImageUrl,
            backImageUrl,
            labelStyle: type === 'card-image-traditional' ? 'traditional' : 'modern',
            subScores,
            showFounderEmblem,
            showVipEmblem,
            showCardLoversEmblem,
          };
          const { front, back } = await generateCardImages(imageData);
          blobs.push({ name: `DCM-${namePrefix}-front.jpg`, mime: 'image/jpeg', dataUrl: await blobToDataUrl(front) });
          blobs.push({ name: `DCM-${namePrefix}-back.jpg`, mime: 'image/jpeg', dataUrl: await blobToDataUrl(back) });
        } else if (type === 'mini-report') {
          postStatus('Generating mini grade report…');
          const [qrCodeDataUrl, logoDataUrl] = await Promise.all([
            generateQRCodeWithLogo(cardUrl).catch(() => ''),
            loadLogoAsBase64().catch(() => undefined),
          ]);
          const fold: FoldableLabelData = {
            cardName: labelData.primaryName,
            setName: labelData.setName || '',
            cardNumber: labelData.cardNumber || undefined,
            year: labelData.year || undefined,
            specialFeatures: labelData.featuresLine || undefined,
            serial: labelData.serial,
            englishName: card.featured || card.pokemon_featured || undefined,
            grade,
            conditionLabel: labelData.condition,
            subgrades: subScores,
            overallSummary: card.conversational_final_grade_summary || 'Card condition analysis not available.',
            qrCodeDataUrl,
            cardUrl,
            logoDataUrl,
          };
          const blob = await generateMiniReportJpg(fold);
          blobs.push({ name: `DCM-${namePrefix}-mini-report.jpg`, mime: 'image/jpeg', dataUrl: await blobToDataUrl(blob) });
        } else if (type === 'onetouch') {
          postStatus('Generating Avery 6871 one-touch label…');
          const [qrCodeDataUrl, logoDataUrl] = await Promise.all([
            generateQRCodeWithLogo(cardUrl).catch(() => ''),
            loadLogoAsBase64().catch(() => ''),
          ]);
          const fold: FoldableLabelData = {
            cardName: labelData.primaryName,
            setName: labelData.setName || '',
            cardNumber: labelData.cardNumber || undefined,
            year: labelData.year || undefined,
            specialFeatures: labelData.featuresLine || undefined,
            serial: labelData.serial,
            englishName: card.featured || card.pokemon_featured || undefined,
            grade,
            conditionLabel: labelData.condition,
            subgrades: subScores,
            overallSummary: card.conversational_final_grade_summary || '',
            qrCodeDataUrl,
            cardUrl,
            logoDataUrl,
          };
          const blob = await generateAveryLabel(fold, position);
          blobs.push({ name: `DCM-OneTouch-${namePrefix}.pdf`, mime: 'application/pdf', dataUrl: await blobToDataUrl(blob) });
        } else if (type === 'toploader' || type === 'foldover') {
          postStatus('Generating Avery 8167 toploader label…');
          const toploaderData = {
            grade,
            conditionLabel: card.conversational_condition_label || labelData.condition,
            qrCodeUrl: cardUrl,
            cardName: labelData.primaryName,
          };
          const blob = type === 'foldover'
            ? await generateFoldOverLabel8167(toploaderData, position)
            : await generateToploaderLabelPair(toploaderData, position, secondPosition);
          blobs.push({
            name: `DCM-Toploader-${type === 'foldover' ? 'Foldover-' : ''}${namePrefix}.pdf`,
            mime: 'application/pdf',
            dataUrl: await blobToDataUrl(blob),
          });
        } else if (type === 'slab-modern' || type === 'slab-traditional') {
          postStatus('Generating slab label PDF…');
          const slabStyle: 'modern' | 'traditional' = type === 'slab-traditional' ? 'traditional' : 'modern';
          const [qrCodeDataUrl, logoDataUrl] = await Promise.all([
            generateQRCodeWithLogo(cardUrl).catch(() => ''),
            loadLogoAsBase64().catch(() => ''),
          ]);
          // SlabLabelData shape per src/lib/slabLabelGenerator.ts
          const slabPayload: any = {
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
            showFounderEmblem,
            showVipEmblem,
            showCardLoversEmblem,
          };
          const blob = format === 'foldover'
            ? await generateFoldOverSlabLabel(slabPayload, slabStyle)
            : await generateSlabLabel(slabPayload, slabStyle);
          blobs.push({
            name: `DCM-Slab-${slabStyle}-${format}-${namePrefix}.pdf`,
            mime: 'application/pdf',
            dataUrl: await blobToDataUrl(blob),
          });
        } else {
          throw new Error(`Unknown label type: ${type}`);
        }

        if (cancelled) return;
        postStatus('Done');
        postToRN({ type: 'label-export-ready', files: blobs });
      } catch (err: any) {
        if (cancelled) return;
        const msg = err?.message || String(err);
        setError(msg);
        postStatus('Error');
        postToRN({ type: 'error', message: msg });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cardId, token, type, format, labelStyleParam]);

  return (
    <div style={{ padding: 16, fontFamily: 'system-ui, sans-serif', fontSize: 14, color: '#374151' }}>
      <p>{status}</p>
      {error && <p style={{ color: '#dc2626' }}>Error: {error}</p>}
    </div>
  );
}
