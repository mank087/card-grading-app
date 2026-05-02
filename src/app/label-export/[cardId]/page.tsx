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
import {
  generateCustomSlabLabel,
  generateFoldOverSlabLabel as generateFoldOverCustomSlabLabel,
} from '@/lib/customSlabLabelGenerator';
import { generateFoldableLabel } from '@/lib/foldableLabelGenerator';
import { pdf } from '@react-pdf/renderer';
import { CardGradingReport, type ReportCardData } from '@/components/reports/CardGradingReport';

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

// PDF library only accepts JPEG/PNG, so we re-encode each card image via canvas.
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

export default function LabelExportPage() {
  const { cardId } = useParams<{ cardId: string }>();
  const sp = useSearchParams();
  const token = sp.get('token') || '';
  const type = sp.get('type') || 'slab-modern';
  const format = (sp.get('format') as 'duplex' | 'foldover') || 'duplex';
  const labelStyleParam = (sp.get('labelStyle') || 'modern') as 'modern' | 'traditional';
  // Inline custom config (base64-encoded JSON) — lets the mobile Label Studio
  // ship the user's IN-FLIGHT customizer config (colors, gradient angle,
  // geometric pattern, layout style, custom colors array, dimensions, border)
  // without saving it to a slot first. Wins over savedCustomStyles when set.
  const inlineCustomConfigRaw = sp.get('customConfig');
  // Avery sheet position (0-based). Defaults to 0 if not provided.
  const position = Math.max(0, parseInt(sp.get('position') || '0', 10) || 0);
  const secondPosition = Math.max(0, parseInt(sp.get('position2') || String(position + 1), 10) || (position + 1));
  // Browser-direct mode — when ?download=1 OR no ReactNativeWebView host, the
  // page triggers a normal browser download for each generated blob (jsPDF's
  // .save() equivalent via anchor click). Used by the mobile app via
  // expo-web-browser to leverage the device browser's download manager —
  // file goes straight to /Downloads on Android, Files on iOS.
  const downloadMode =
    sp.get('download') === '1' ||
    (typeof window !== 'undefined' && !window.ReactNativeWebView);
  const [status, setStatus] = useState('Initializing…');
  const [error, setError] = useState<string | null>(null);
  const [doneFiles, setDoneFiles] = useState<{ name: string; url: string; mime: string }[]>([]);

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

        // Look up emblem entitlements + saved custom label styles in one query.
        let showFounderEmblem = false;
        let showVipEmblem = false;
        let showCardLoversEmblem = false;
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
        } catch (e) {
          console.warn('[label-export] user_credits lookup failed (non-fatal):', e);
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
        } else if (type === 'full-report') {
          // Full grading report PDF — same data shape as web's DownloadReportButton
          // (src/components/reports/DownloadReportButton.tsx) so all AI-written
          // sub-grade summaries, the overall condition summary, AI confidence, and
          // image-quality blurb show up.
          postStatus('Loading card images…');
          let frontJpeg = '';
          let backJpeg = '';
          try { frontJpeg = await imageToJpegBase64(frontImageUrl); } catch (err) { console.warn('[full-report] front image failed:', err); }
          try { backJpeg = await imageToJpegBase64(backImageUrl); } catch (err) { console.warn('[full-report] back image failed:', err); }
          postStatus('Building grading report…');
          const cardInfo = card.conversational_card_info || {};

          // AI-written sub-grade summaries live in conversational_corners_edges_surface
          // under {front,back}_{centering,corners,edges,surface}.summary. Mirrors the
          // extract*Summary helpers in DownloadReportButton.tsx.
          const ces = card.conversational_corners_edges_surface || {};
          const summary = (frontKey: string, backKey: string, fallback: string) => {
            const fs = ces[frontKey]?.summary || '';
            const bs = ces[backKey]?.summary || '';
            const combined = fs && bs ? `Front: ${fs} Back: ${bs}` : (fs || bs || fallback);
            return { front: fs || fallback, back: bs || fallback, combined };
          };
          const cenSum = summary('front_centering', 'back_centering', 'Centering analysis not available.');
          const corSum = summary('front_corners', 'back_corners', 'Corner analysis not available.');
          const edgSum = summary('front_edges', 'back_edges', 'Edge analysis not available.');
          const sufSum = summary('front_surface', 'back_surface', 'Surface analysis not available.');

          const aiConfidence = card.conversational_image_confidence || 'N/A';
          const imageQualityMap: Record<string, string> = {
            A: 'Excellent - High confidence in grade accuracy',
            B: 'Good - Moderate confidence in grade accuracy',
            C: 'Fair - Lower confidence due to image limitations',
            D: 'Poor - Significant image quality issues affecting analysis',
          };
          const imageQuality = imageQualityMap[aiConfidence] || 'Quality assessment not available';

          // gradeRange in the format CardGradingReport expects: "10 ± 0.25"
          const uncertaintyMatch = (card.conversational_grade_uncertainty || '±0.25').match(/±\s*([\d.]+)/);
          const gradeRange = `${labelData.grade ?? 0} ± ${uncertaintyMatch ? uncertaintyMatch[1] : '0.25'}`;

          const qrCodeDataUrl = await generateQRCodeWithLogo(cardUrl).catch(() => '');
          const safePrimary = labelData.primaryName || 'Card';
          const safeContext = labelData.contextLine || '';
          const safeFeatures = labelData.featuresLine || null;

          const reportCardData: ReportCardData = {
            primaryName: safePrimary,
            contextLine: safeContext,
            featuresLine: safeFeatures,
            serial: card.serial,
            grade: labelData.grade ?? 0,
            gradeFormatted: (labelData as any).gradeFormatted || ((labelData.grade ?? 0) % 1 === 0 ? String(labelData.grade ?? 0) : (labelData.grade ?? 0).toFixed(1)),
            condition: labelData.condition || getConditionLabel(labelData.grade ?? 0),
            cardName: safePrimary,
            playerName: safePrimary,
            setName: labelData.setName || '',
            year: labelData.year || '',
            cardNumber: labelData.cardNumber || '',
            manufacturer: cardInfo.manufacturer || card.manufacturer_name || '',
            sport: cardInfo.sport_or_category || card.category || '',
            frontImageUrl: frontJpeg,
            backImageUrl: backJpeg,
            conditionLabel: card.conversational_condition_label || labelData.condition || getConditionLabel(labelData.grade ?? 0),
            labelCondition: labelData.condition || getConditionLabel(labelData.grade ?? 0),
            gradeRange,
            cardDetails: safeContext,
            specialFeaturesString: safeFeatures || '',
            cardUrl,
            qrCodeDataUrl,
            professionalGrades: {
              psa: card.estimated_professional_grades?.PSA?.numeric_score || 'N/A',
              bgs: card.estimated_professional_grades?.BGS?.numeric_score || 'N/A',
              sgc: card.estimated_professional_grades?.SGC?.numeric_score || 'N/A',
              cgc: card.estimated_professional_grades?.CGC?.numeric_score || 'N/A',
            },
            subgrades: {
              centering: {
                score: w.centering ?? s.centering?.weighted ?? 0,
                frontScore: s.centering?.front ?? 0,
                backScore: s.centering?.back ?? 0,
                summary: cenSum.combined,
                frontSummary: cenSum.front,
                backSummary: cenSum.back,
              },
              corners: {
                score: w.corners ?? s.corners?.weighted ?? 0,
                frontScore: s.corners?.front ?? 0,
                backScore: s.corners?.back ?? 0,
                summary: corSum.combined,
                frontSummary: corSum.front,
                backSummary: corSum.back,
              },
              edges: {
                score: w.edges ?? s.edges?.weighted ?? 0,
                frontScore: s.edges?.front ?? 0,
                backScore: s.edges?.back ?? 0,
                summary: edgSum.combined,
                frontSummary: edgSum.front,
                backSummary: edgSum.back,
              },
              surface: {
                score: w.surface ?? s.surface?.weighted ?? 0,
                frontScore: s.surface?.front ?? 0,
                backScore: s.surface?.back ?? 0,
                summary: sufSum.combined,
                frontSummary: sufSum.front,
                backSummary: sufSum.back,
              },
            },
            specialFeatures: {
              rookie: cardInfo.rookie_or_first === 'Yes' || cardInfo.rookie_or_first === true || card.rookie_card,
              autographed: cardInfo.autographed === true || !!card.autograph_type,
              serialNumbered: cardInfo.serial_number || card.serial_numbering || undefined,
              subset: cardInfo.subset || card.subset || undefined,
              isFoil: card.is_foil || false,
              foilType: card.foil_type || undefined,
              isDoubleFaced: card.is_double_faced || false,
              rarity: card.mtg_rarity || undefined,
            },
            aiConfidence,
            imageQuality,
            overallSummary: card.conversational_final_grade_summary || undefined,
            generatedDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
            reportId: card.id.substring(0, 8).toUpperCase(),
          } as any;

          const pdfBlob = await pdf(<CardGradingReport cardData={reportCardData} />).toBlob();
          blobs.push({ name: `DCM-Report-${namePrefix}-${card.serial}.pdf`, mime: 'application/pdf', dataUrl: await blobToDataUrl(pdfBlob) });
        } else if (type === 'mini-report-pdf') {
          // Mini-report PDF — same generator the web's "Mini-Report (PDF)" uses.
          postStatus('Generating mini-report PDF…');
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
          const blob = await generateFoldableLabel(fold);
          blobs.push({ name: `DCM-MiniReport-${namePrefix}.pdf`, mime: 'application/pdf', dataUrl: await blobToDataUrl(blob) });
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
        } else if (type === 'slab-custom') {
          // User has a custom label style selected; use the matching saved
          // CustomLabelConfig and the custom slab generators (which support
          // gradients, geometric patterns, neon outlines, card-extension,
          // etc.). The mobile Label Studio passes the IN-FLIGHT customizer
          // config via ?customConfig=<base64-json> so the download reflects
          // exactly what the user is currently designing — without forcing a
          // save-to-slot first.
          postStatus('Generating custom slab label PDF…');
          let config: any = null;
          if (inlineCustomConfigRaw) {
            try {
              const decoded = decodeURIComponent(inlineCustomConfigRaw);
              const json = atob(decoded);
              config = JSON.parse(json);
            } catch (err) {
              console.warn('[label-export] Failed to parse inline customConfig:', err);
            }
          }
          if (!config) {
            config = savedCustomStyles.find(s => s.id === labelStyleParam)?.config;
          }
          if (!config) {
            throw new Error(`Could not find a custom label config. Save one in Label Studio first or pass an inline config.`);
          }
          const [qrCodeDataUrl, logoDataUrl] = await Promise.all([
            generateQRCodeWithLogo(cardUrl).catch(() => ''),
            loadLogoAsBase64().catch(() => ''),
          ]);
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
            ? await generateFoldOverCustomSlabLabel(slabPayload, config)
            : await generateCustomSlabLabel(slabPayload, config);
          blobs.push({
            name: `DCM-Slab-Custom-${format}-${namePrefix}.pdf`,
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

        if (downloadMode) {
          // Browser-direct: trigger a real <a download> click for each blob so
          // the device's browser save the file to its Downloads folder. Mobile
          // wraps this URL in expo-web-browser and stays in-app while the
          // browser tab handles the actual save.
          const links: { name: string; url: string; mime: string }[] = [];
          for (const f of blobs) {
            const url = f.dataUrl;
            const a = document.createElement('a');
            a.href = url;
            a.download = f.name;
            a.rel = 'noopener';
            document.body.appendChild(a);
            a.click();
            a.remove();
            links.push({ name: f.name, url, mime: f.mime });
          }
          setDoneFiles(links);
          postStatus(`Downloaded ${blobs.length} file${blobs.length === 1 ? '' : 's'}`);
        } else {
          postToRN({ type: 'label-export-ready', files: blobs });
        }
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

  if (downloadMode) {
    return (
      <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif', maxWidth: 480, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img src="/DCM-logo.png" alt="DCM Grading" style={{ width: 56, height: 56, margin: '0 auto 12px', display: 'block' }} />
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: 0 }}>Label Download</h1>
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
              <p style={{ fontSize: 12, color: '#16a34a', margin: '4px 0 0' }}>
                Check your Downloads folder.
              </p>
            </div>
            {doneFiles.map((f, i) => (
              <a
                key={i}
                href={f.url}
                download={f.name}
                style={{ display: 'block', padding: 12, background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 8, color: '#111827', textDecoration: 'none', fontSize: 13 }}
              >
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
