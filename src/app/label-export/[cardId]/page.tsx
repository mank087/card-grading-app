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
  const [status, setStatus] = useState('Initializing…');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!cardId || !token) throw new Error('Missing cardId or token');
        setStatus('Loading card…');
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
          setStatus('Generating slab card images…');
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
          };
          const { front, back } = await generateCardImages(imageData);
          blobs.push({ name: `DCM-${namePrefix}-front.jpg`, mime: 'image/jpeg', dataUrl: await blobToDataUrl(front) });
          blobs.push({ name: `DCM-${namePrefix}-back.jpg`, mime: 'image/jpeg', dataUrl: await blobToDataUrl(back) });
        } else if (type === 'mini-report') {
          setStatus('Generating mini grade report…');
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
          setStatus('Generating Avery 6871 one-touch label…');
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
          const blob = await generateAveryLabel(fold, 0);
          blobs.push({ name: `DCM-OneTouch-${namePrefix}.pdf`, mime: 'application/pdf', dataUrl: await blobToDataUrl(blob) });
        } else if (type === 'toploader' || type === 'foldover') {
          setStatus('Generating Avery 8167 toploader label…');
          const toploaderData = {
            grade,
            conditionLabel: card.conversational_condition_label || labelData.condition,
            qrCodeUrl: cardUrl,
            cardName: labelData.primaryName,
          };
          const blob = type === 'foldover'
            ? await generateFoldOverLabel8167(toploaderData, 0)
            : await generateToploaderLabelPair(toploaderData, 0, 1);
          blobs.push({
            name: `DCM-Toploader-${type === 'foldover' ? 'Foldover-' : ''}${namePrefix}.pdf`,
            mime: 'application/pdf',
            dataUrl: await blobToDataUrl(blob),
          });
        } else if (type === 'slab-modern' || type === 'slab-traditional') {
          setStatus('Generating slab label PDF…');
          const slabStyle = type === 'slab-traditional' ? 'traditional' : 'modern';
          const slabPayload: any = {
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
            cardUrl,
            style: slabStyle,
          };
          const blob = format === 'foldover'
            ? await generateFoldOverSlabLabel(slabPayload)
            : await generateSlabLabel(slabPayload);
          blobs.push({
            name: `DCM-Slab-${slabStyle}-${format}-${namePrefix}.pdf`,
            mime: 'application/pdf',
            dataUrl: await blobToDataUrl(blob),
          });
        } else {
          throw new Error(`Unknown label type: ${type}`);
        }

        if (cancelled) return;
        setStatus('Done');
        postToRN({ type: 'label-export-ready', files: blobs });
      } catch (err: any) {
        if (cancelled) return;
        const msg = err?.message || String(err);
        setError(msg);
        setStatus('Error');
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
