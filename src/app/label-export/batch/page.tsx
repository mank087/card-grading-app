'use client';

/**
 * Batch Label Export — multi-card variant of /label-export/[cardId].
 *
 * Loaded by the mobile Collection screen via expo-web-browser when the
 * user picks a batch label/report type. URL params:
 *
 *   ?token=<jwt>                                 — Supabase auth
 *   &cardIds=id1,id2,id3                         — comma-separated card IDs
 *   &type=slab-modern|slab-traditional|slab-custom|foldover|
 *         onetouch|toploader|toploader-foldover|
 *         card-image-modern|card-image-traditional|
 *         mini-report|mini-report-pdf|full-report
 *   &format=duplex|foldover                      — slab labels only
 *   &positions=0,1,2,3                           — Avery sheet positions for
 *                                                   onetouch (6871) and
 *                                                   toploader/8167 — array of
 *                                                   GLOBAL position indices,
 *                                                   one per card; multi-page
 *                                                   auto-paginates
 *   &customConfig=<base64-json>                  — slab-custom only
 *   &download=1                                  — auto-trigger browser download
 *
 * Returns: a SINGLE merged PDF for label/report types (jsPDF / react-pdf),
 * or a series of <a download> clicks for digital card-image JPG pairs.
 *
 * Reuses the same browser-direct download UX as the single-card export page
 * — the in-app browser stays open with re-download links until the user
 * dismisses it.
 */

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { getCardLabelData } from '@/lib/useLabelData';
import { generateBatchSlabLabels, generateBatchFoldOverSlabLabels } from '@/lib/slabLabelGenerator';
import {
  generateBatchCustomSlabLabels,
  generateBatchFoldOverCustomLabels,
} from '@/lib/customSlabLabelGenerator';
import { generateAveryLabelSheetMultiPage } from '@/lib/averyLabelGenerator';
import { generateToploaderLabelSheetMultiPage, generateFoldOverLabelSheet } from '@/lib/avery8167LabelGenerator';
import { generateBatchFoldableLabels, generateQRCodeWithLogo, loadLogoAsBase64, loadWhiteLogoAsBase64, type FoldableLabelData } from '@/lib/foldableLabelGenerator';
import { generateMiniReportJpg } from '@/lib/miniReportJpgGenerator';
import { generateCardImages, type CardImageData } from '@/lib/cardImageGenerator';
import { pdf } from '@react-pdf/renderer';
import { CardGradingReport, type ReportCardData } from '@/components/reports/CardGradingReport';

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (data: string) => void };
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
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

function getConditionLabel(grade: number): string {
  if (grade >= 10) return 'Pristine';
  if (grade >= 9) return 'Gem Mint';
  if (grade >= 8) return 'Near Mint-Mint';
  if (grade >= 7) return 'Near Mint';
  if (grade >= 6) return 'Excellent-Mint';
  if (grade >= 5) return 'Excellent';
  if (grade >= 4) return 'Very Good-Excellent';
  if (grade >= 3) return 'Very Good';
  if (grade >= 2) return 'Good';
  if (grade >= 1) return 'Fair';
  return 'Poor';
}

async function imageToJpegBase64(imageUrl: string): Promise<string> {
  const response = await fetch(imageUrl);
  const blob = await response.blob();
  const img = new Image();
  img.crossOrigin = 'anonymous';
  return new Promise((resolve, reject) => {
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('canvas ctx'));
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      } catch (e) { reject(e); }
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(blob);
  });
}

interface DoneFile { name: string; url: string; mime: string }

export default function BatchLabelExportPage() {
  const sp = useSearchParams();
  const token = sp.get('token') || '';
  const cardIdsParam = sp.get('cardIds') || '';
  const cardIds = cardIdsParam.split(',').map(s => s.trim()).filter(Boolean);
  const type = sp.get('type') || 'slab-modern';
  const format = (sp.get('format') as 'duplex' | 'foldover') || 'duplex';
  const positionsParam = sp.get('positions') || '';
  const positions = positionsParam ? positionsParam.split(',').map(s => parseInt(s.trim(), 10)).filter(n => Number.isFinite(n) && n >= 0) : [];
  const inlineCustomConfigRaw = sp.get('customConfig');
  const downloadMode = sp.get('download') === '1' || (typeof window !== 'undefined' && !window.ReactNativeWebView);

  const [status, setStatus] = useState('Initializing…');
  const [error, setError] = useState<string | null>(null);
  const [doneFiles, setDoneFiles] = useState<DoneFile[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!token) throw new Error('Missing token');
        if (cardIds.length === 0) throw new Error('Missing cardIds');
        if (cardIds.length > 100) throw new Error('Batch size too large (max 100 cards per request)');

        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          { global: { headers: { Authorization: `Bearer ${token}` } } },
        );

        setStatus(`Loading ${cardIds.length} cards…`);
        const { data: cards, error: cardsErr } = await supabase
          .from('cards').select('*').in('id', cardIds);
        if (cardsErr || !cards) throw new Error(cardsErr?.message || 'Could not load cards');
        if (cards.length === 0) throw new Error('No cards found for these IDs');

        // Re-order cards to match the requested cardIds sequence (Avery
        // positions array depends on this order).
        const cardsById = new Map(cards.map(c => [c.id, c]));
        const orderedCards = cardIds.map(id => cardsById.get(id)).filter(Boolean) as any[];
        if (orderedCards.length === 0) throw new Error('No matching cards loaded');

        // Signed URLs for all front/back images (for card-image + mini-report types).
        const allPaths: string[] = [];
        orderedCards.forEach(c => {
          if (c.front_path) allPaths.push(c.front_path);
          if (c.back_path) allPaths.push(c.back_path);
        });
        const { data: signed } = await supabase.storage.from('cards').createSignedUrls(allPaths, 3600);
        const signedByPath = new Map((signed ?? []).map(s => [s.path, s.signedUrl]));

        // Emblems
        let showFounderEmblem = false, showVipEmblem = false, showCardLoversEmblem = false;
        let savedCustomStyles: Array<{ id: string; name: string; config: any }> = [];
        try {
          const { data: creditsRow } = await supabase
            .from('user_credits')
            .select('is_founder, is_vip, is_card_lover, show_founder_badge, show_vip_badge, show_card_lover_badge, preferred_label_emblem, custom_label_styles')
            .single();
          if (creditsRow) {
            const selected: string[] = (creditsRow.preferred_label_emblem || '')
              .split(',').map((s: string) => s.trim()).filter(Boolean);
            showFounderEmblem = !!creditsRow.is_founder && creditsRow.show_founder_badge !== false && selected.includes('founder');
            showVipEmblem = !!creditsRow.is_vip && creditsRow.show_vip_badge !== false && selected.includes('vip');
            showCardLoversEmblem = !!creditsRow.is_card_lover && creditsRow.show_card_lover_badge !== false && selected.includes('card_lover');
            if (Array.isArray(creditsRow.custom_label_styles)) {
              savedCustomStyles = creditsRow.custom_label_styles as any[];
            }
          }
        } catch { /* non-fatal */ }

        const [logoDataUrl, whiteLogoDataUrl] = await Promise.all([
          loadLogoAsBase64().catch(() => ''),
          loadWhiteLogoAsBase64().catch(() => ''),
        ]);

        const blobs: { name: string; mime: string; dataUrl: string }[] = [];

        // Build per-card payloads (label data + grade + sub scores + QR)
        setStatus('Building label data…');
        const perCard = await Promise.all(orderedCards.map(async (card: any) => {
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
          const qrCodeDataUrl = await generateQRCodeWithLogo(cardUrl).catch(() => '');
          return { card, labelData, subScores, grade, cardUrl, qrCodeDataUrl };
        }));

        // ------------------------------------------------------------
        // SLAB LABELS (modern / traditional)
        // ------------------------------------------------------------
        if (type === 'slab-modern' || type === 'slab-traditional') {
          setStatus(`Generating ${cardIds.length} slab labels (${format})…`);
          const slabStyle: 'modern' | 'traditional' = type === 'slab-traditional' ? 'traditional' : 'modern';
          const slabPayloads = perCard.map(({ card, labelData, subScores, grade, qrCodeDataUrl }) => ({
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
          })) as any[];
          const blob = format === 'foldover'
            ? await generateBatchFoldOverSlabLabels(slabPayloads, slabStyle)
            : await generateBatchSlabLabels(slabPayloads, slabStyle);
          blobs.push({
            name: `DCM-Slab-${slabStyle}-${format}-${cardIds.length}cards.pdf`,
            mime: 'application/pdf',
            dataUrl: await blobToDataUrl(blob),
          });
        }

        // ------------------------------------------------------------
        // SLAB CUSTOM
        // ------------------------------------------------------------
        else if (type === 'slab-custom') {
          setStatus(`Generating ${cardIds.length} custom slab labels (${format})…`);
          let config: any = null;
          if (inlineCustomConfigRaw) {
            try { config = JSON.parse(atob(decodeURIComponent(inlineCustomConfigRaw))); } catch {}
          }
          if (!config) config = savedCustomStyles[0]?.config;
          if (!config) throw new Error('No custom label config available — save one in Label Studio first.');

          const slabPayloads = perCard.map(({ card, labelData, subScores, grade, qrCodeDataUrl }) => ({
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
          })) as any[];
          const blob = format === 'foldover'
            ? await generateBatchFoldOverCustomLabels(slabPayloads, config)
            : await generateBatchCustomSlabLabels(slabPayloads, config);
          blobs.push({
            name: `DCM-Slab-Custom-${format}-${cardIds.length}cards.pdf`,
            mime: 'application/pdf',
            dataUrl: await blobToDataUrl(blob),
          });
        }

        // ------------------------------------------------------------
        // ONE-TOUCH (Avery 6871) — 18 per page, 3-col × 6-row
        // ------------------------------------------------------------
        else if (type === 'onetouch') {
          setStatus(`Generating ${cardIds.length} one-touch labels…`);
          const labelDataArray: FoldableLabelData[] = perCard.map(({ card, labelData, subScores, grade, qrCodeDataUrl }) => ({
            cardName: labelData.primaryName,
            contextLine: labelData.contextLine || '',
            specialFeatures: labelData.featuresLine || undefined,
            serial: labelData.serial,
            grade,
            conditionLabel: labelData.condition || getConditionLabel(grade),
            cardUrl: `${window.location.origin}/verify/${card.serial}`,
            qrCodeDataUrl,
            logoDataUrl,
            subScores,
            showFounderEmblem,
            showVipEmblem,
            showCardLoversEmblem,
          })) as any[];
          const globalPositions = positions.length === labelDataArray.length ? positions : undefined;
          const blob = await generateAveryLabelSheetMultiPage(labelDataArray, undefined, globalPositions);
          blobs.push({
            name: `DCM-OneTouch-Avery6871-${cardIds.length}cards.pdf`,
            mime: 'application/pdf',
            dataUrl: await blobToDataUrl(blob),
          });
        }

        // ------------------------------------------------------------
        // TOPLOADER (Avery 8167 standard front+back) — 80 labels/page
        // ------------------------------------------------------------
        else if (type === 'toploader') {
          setStatus(`Generating ${cardIds.length} toploader label pairs…`);
          const labelDataArray = perCard.map(({ card, labelData, subScores, grade, qrCodeDataUrl }) => ({
            cardName: labelData.primaryName,
            contextLine: labelData.contextLine || '',
            specialFeatures: labelData.featuresLine || undefined,
            serial: labelData.serial,
            grade,
            conditionLabel: labelData.condition || getConditionLabel(grade),
            cardUrl: `${window.location.origin}/verify/${card.serial}`,
            qrCodeDataUrl,
            logoDataUrl,
            subScores,
            showFounderEmblem,
            showVipEmblem,
            showCardLoversEmblem,
          }));
          const globalPositions = positions.length === labelDataArray.length ? positions : undefined;
          const blob = await generateToploaderLabelSheetMultiPage(labelDataArray as any, undefined, globalPositions);
          blobs.push({
            name: `DCM-Toploader-Avery8167-${cardIds.length}cards.pdf`,
            mime: 'application/pdf',
            dataUrl: await blobToDataUrl(blob),
          });
        }

        // ------------------------------------------------------------
        // FOLD-OVER TOPLOADER (Avery 8167 foldover) — 80 per page
        // ------------------------------------------------------------
        else if (type === 'foldover' || type === 'toploader-foldover') {
          setStatus(`Generating ${cardIds.length} fold-over toploader labels…`);
          const labelDataArray = perCard.map(({ card, labelData, subScores, grade, qrCodeDataUrl }) => ({
            cardName: labelData.primaryName,
            contextLine: labelData.contextLine || '',
            specialFeatures: labelData.featuresLine || undefined,
            serial: labelData.serial,
            grade,
            conditionLabel: labelData.condition || getConditionLabel(grade),
            cardUrl: `${window.location.origin}/verify/${card.serial}`,
            qrCodeDataUrl,
            logoDataUrl,
            subScores,
            showFounderEmblem,
            showVipEmblem,
            showCardLoversEmblem,
          }));
          // generateFoldOverLabelSheet takes startPosition (single number) and
          // auto-fills the rest sequentially. Use the first position from the
          // array if provided, otherwise start at 0.
          const startPosition = positions.length > 0 ? positions[0] : 0;
          const blob = await generateFoldOverLabelSheet(labelDataArray as any, undefined, startPosition);
          blobs.push({
            name: `DCM-FoldOver-Avery8167-${cardIds.length}cards.pdf`,
            mime: 'application/pdf',
            dataUrl: await blobToDataUrl(blob),
          });
        }

        // ------------------------------------------------------------
        // MINI-REPORT (PDF — foldable summary card per card)
        // ------------------------------------------------------------
        else if (type === 'mini-report-pdf') {
          setStatus(`Generating ${cardIds.length} mini-report PDFs…`);
          const labelDataArray: FoldableLabelData[] = perCard.map(({ card, labelData, subScores, grade, qrCodeDataUrl }) => ({
            cardName: labelData.primaryName,
            contextLine: labelData.contextLine || '',
            specialFeatures: labelData.featuresLine || undefined,
            serial: labelData.serial,
            grade,
            conditionLabel: labelData.condition || getConditionLabel(grade),
            cardUrl: `${window.location.origin}/verify/${card.serial}`,
            qrCodeDataUrl,
            logoDataUrl,
            subScores,
            showFounderEmblem,
            showVipEmblem,
            showCardLoversEmblem,
          })) as any[];
          const blob = await generateBatchFoldableLabels(labelDataArray);
          blobs.push({
            name: `DCM-MiniReports-${cardIds.length}cards.pdf`,
            mime: 'application/pdf',
            dataUrl: await blobToDataUrl(blob),
          });
        }

        // ------------------------------------------------------------
        // MINI-REPORT (JPG image, one per card)
        // ------------------------------------------------------------
        else if (type === 'mini-report') {
          setStatus(`Generating ${cardIds.length} mini-report JPGs…`);
          for (let i = 0; i < perCard.length; i++) {
            const { card, labelData, subScores, grade, cardUrl } = perCard[i];
            const frontUrl = signedByPath.get(card.front_path) || '';
            const namePrefix = sanitize(labelData.primaryName || `card-${card.serial}`);
            const blob = await generateMiniReportJpg({
              cardName: labelData.primaryName,
              contextLine: labelData.contextLine || '',
              specialFeatures: labelData.featuresLine || undefined,
              serial: labelData.serial,
              grade,
              conditionLabel: labelData.condition || getConditionLabel(grade),
              cardUrl,
              cardImageUrl: frontUrl,
              subScores,
            } as any);
            blobs.push({
              name: `DCM-MiniReport-${namePrefix}.jpg`,
              mime: 'image/jpeg',
              dataUrl: await blobToDataUrl(blob),
            });
            setStatus(`Generated ${i + 1} / ${perCard.length} mini-reports…`);
          }
        }

        // ------------------------------------------------------------
        // FULL REPORT — react-pdf, multi-card
        // ------------------------------------------------------------
        else if (type === 'full-report') {
          setStatus(`Generating ${cardIds.length}-card full grading report…`);
          const reportCards: ReportCardData[] = await Promise.all(perCard.map(async ({ card, labelData, subScores, grade, cardUrl, qrCodeDataUrl }) => {
            const frontUrl = signedByPath.get(card.front_path) || '';
            const backUrl = signedByPath.get(card.back_path) || '';
            const [frontImage, backImage] = await Promise.all([
              frontUrl ? imageToJpegBase64(frontUrl).catch(() => '') : '',
              backUrl ? imageToJpegBase64(backUrl).catch(() => '') : '',
            ]);
            return {
              cardName: labelData.primaryName,
              contextLine: labelData.contextLine || '',
              specialFeatures: labelData.featuresLine || '',
              serial: labelData.serial,
              grade,
              conditionLabel: labelData.condition || getConditionLabel(grade),
              cardUrl,
              qrCodeDataUrl,
              subScores,
              frontImage,
              backImage,
              graderName: 'DCM Grading',
              gradedAt: card.graded_at || card.created_at,
              card,
            } as any;
          }));
          // Render each card as a CardGradingReport, merge into one PDF.
          // CardGradingReport handles single card; for batch we render a
          // sequence and the react-pdf renderer auto-paginates.
          const blob = await pdf(<CardGradingReport cardData={reportCards as any} />).toBlob();
          blobs.push({
            name: `DCM-Full-Report-${cardIds.length}cards.pdf`,
            mime: 'application/pdf',
            dataUrl: await blobToDataUrl(blob),
          });
        }

        // ------------------------------------------------------------
        // CARD IMAGE batch — one JPG pair (front + back) per card
        // ------------------------------------------------------------
        else if (type === 'card-image-modern' || type === 'card-image-traditional') {
          setStatus(`Generating ${cardIds.length} card image pairs…`);
          const labelStyle: 'modern' | 'traditional' = type === 'card-image-traditional' ? 'traditional' : 'modern';
          for (let i = 0; i < perCard.length; i++) {
            const { card, labelData, subScores, grade, cardUrl } = perCard[i];
            const frontUrl = signedByPath.get(card.front_path) || '';
            const backUrl = signedByPath.get(card.back_path) || '';
            const namePrefix = sanitize(labelData.primaryName || `card-${card.serial}`);
            const imageData: CardImageData = {
              cardName: labelData.primaryName,
              contextLine: labelData.contextLine,
              specialFeatures: labelData.featuresLine || undefined,
              serial: labelData.serial,
              englishName: card.featured || card.pokemon_featured || undefined,
              grade,
              conditionLabel: labelData.condition || getConditionLabel(grade),
              cardUrl,
              frontImageUrl: frontUrl,
              backImageUrl: backUrl,
              labelStyle,
              subScores,
              showFounderEmblem,
              showVipEmblem,
              showCardLoversEmblem,
            } as any;
            const { front, back } = await generateCardImages(imageData);
            blobs.push({ name: `DCM-CardImage-${namePrefix}-front.jpg`, mime: 'image/jpeg', dataUrl: await blobToDataUrl(front) });
            blobs.push({ name: `DCM-CardImage-${namePrefix}-back.jpg`, mime: 'image/jpeg', dataUrl: await blobToDataUrl(back) });
            setStatus(`Generated ${i + 1} / ${perCard.length} card images…`);
          }
        }

        else {
          throw new Error(`Unknown batch label type: ${type}`);
        }

        if (cancelled) return;
        setStatus(`Done — ${blobs.length} file${blobs.length === 1 ? '' : 's'} ready`);

        if (downloadMode) {
          const links: DoneFile[] = [];
          for (const f of blobs) {
            const a = document.createElement('a');
            a.href = f.dataUrl;
            a.download = f.name;
            a.rel = 'noopener';
            document.body.appendChild(a);
            a.click();
            a.remove();
            links.push({ name: f.name, url: f.dataUrl, mime: f.mime });
          }
          setDoneFiles(links);
          setStatus(`Downloaded ${blobs.length} file${blobs.length === 1 ? '' : 's'}`);
        } else if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'label-export-ready', files: blobs }));
        }
      } catch (err: any) {
        if (cancelled) return;
        const msg = err?.message || String(err);
        setError(msg);
        setStatus('Error');
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: msg }));
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, cardIdsParam, type, format, positionsParam, inlineCustomConfigRaw, downloadMode]);

  if (downloadMode) {
    return (
      <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif', maxWidth: 480, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img src="/DCM-logo.png" alt="DCM Grading" style={{ width: 56, height: 56, margin: '0 auto 12px', display: 'block' }} />
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: 0 }}>Batch Label Download</h1>
          <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0' }}>{cardIds.length} card{cardIds.length === 1 ? '' : 's'}</p>
        </div>
        {!error && doneFiles.length === 0 && (
          <div style={{ textAlign: 'center', padding: 32, background: '#f9fafb', borderRadius: 12 }}>
            <div style={{ width: 32, height: 32, border: '3px solid #e5e7eb', borderTopColor: '#7c3aed', borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>{status}</p>
          </div>
        )}
        {doneFiles.length > 0 && (
          <div>
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: 16, borderRadius: 12, marginBottom: 16, textAlign: 'center' }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#15803d', margin: 0 }}>
                ✓ Downloaded {doneFiles.length} file{doneFiles.length === 1 ? '' : 's'}
              </p>
              <p style={{ fontSize: 12, color: '#16a34a', margin: '4px 0 0' }}>Check your Downloads folder.</p>
            </div>
            {doneFiles.map((f, i) => (
              <a key={i} href={f.url} download={f.name}
                style={{ display: 'block', padding: 12, background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 8, color: '#111827', textDecoration: 'none', fontSize: 13 }}>
                ↓ Re-download {f.name}
              </a>
            ))}
          </div>
        )}
        {error && (
          <div style={{ padding: 16, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12 }}>
            <p style={{ color: '#dc2626', fontSize: 13, margin: 0 }}>Error: {error}</p>
          </div>
        )}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, fontFamily: 'system-ui, sans-serif', fontSize: 14, color: '#374151' }}>
      <p>{status}</p>
      {error && <p style={{ color: '#dc2626' }}>Error: {error}</p>}
    </div>
  );
}
