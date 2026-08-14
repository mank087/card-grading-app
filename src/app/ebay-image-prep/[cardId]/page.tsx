'use client';

/**
 * eBay Image Prep page — loaded in a hidden WebView from the mobile app.
 *
 * Takes a cardId (path param) and an access token (query param), runs the
 * existing client-side canvas image generators (slab-overlaid front/back,
 * mini grade report, raw front/back), and posts the resulting base64 data
 * URLs back to React Native via window.ReactNativeWebView.postMessage.
 *
 * Mobile listens to onMessage and uses these data URLs for previews + the
 * eBay /api/ebay/images upload step.
 *
 * Bridge protocols (selected by the ?bridge query param):
 * - bridge=2 (chunked): one { type: 'ebay-prep-image', key, dataUrl, index,
 *   total } message per image, then a final { type: 'ebay-prep-complete',
 *   description, itemSpecifics, categoryId, regulatoryDocumentId } message.
 *   Requested by new app builds — a single ~10 MB postMessage is copied
 *   whole across the RN bridge and can jank/OOM low-end Android devices.
 * - legacy (no param): one { type: 'images-ready', images: {…5 data URLs},
 *   …metadata } message. Kept for old app builds that predate the chunked
 *   handler; they load this page without ?bridge.
 */

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { generateCardImages, generateRawCardImages, type CardImageData } from '@/lib/cardImageGenerator';
import { generateMiniReportJpg } from '@/lib/miniReportJpgGenerator';
import { generateQRCodeWithLogo, type FoldableLabelData } from '@/lib/foldableLabelGenerator';
import { loadLogosForCard, cardQrUrl } from '@/lib/orgBranding';
import { generateHtmlDescription } from '@/lib/ebay/listingDescription';
import { getCardLabelData } from '@/lib/useLabelData';
import { categoryToRouteSlug } from '@/lib/postGradeEmailTemplates';
import { resolveEmblemVisibility } from '@/lib/labelEmblems';
import { resolveHeritageSelection } from '@/lib/labels/labelStyleResolution';
import { resolveHeritageBandColors } from '@/lib/labelLab/heritageLayout';
import { mapCardToItemSpecifics, getCategoryForCardType } from '@/lib/ebay/itemSpecifics';
import { pdf } from '@react-pdf/renderer';
import { CardGradingReport, type ReportCardData } from '@/components/reports/CardGradingReport';

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (data: string) => void };
  }
}

function postToRN(payload: any) {
  const message = JSON.stringify(payload);
  if (typeof window !== 'undefined' && window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(message);
  }
  // Also log so we can see it in WebView debugger
  console.log('[eBay Image Prep]', message.slice(0, 200));
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function getGradeColor(grade: number): string {
  if (grade >= 9) return '#10B981';
  if (grade >= 7) return '#3B82F6';
  if (grade >= 5) return '#F59E0B';
  return '#EF4444';
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

// Convert a remote image URL to a JPEG base64 (PDF lib doesn't support WebP)
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


export default function EbayImagePrepPage() {
  const { cardId } = useParams<{ cardId: string }>();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const labelStyleParam = (searchParams.get('labelStyle') || 'modern') as
    | 'modern' | 'traditional' | 'heritage' | 'custom-1' | 'custom-2' | 'custom-3' | 'custom-4';
  // Chunked bridge protocol requested by new app builds (see header comment).
  const chunkedBridge = searchParams.get('bridge') === '2';
  const [status, setStatus] = useState('Initializing…');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!cardId || !token) {
          throw new Error('Missing cardId or token');
        }
        setStatus('Loading card…');
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const supabase = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: `Bearer ${token}` } },
        });

        // Use service-role-less query — RLS on cards lets the user read their own row
        const { data: card, error: cardErr } = await supabase
          .from('cards')
          .select('*')
          .eq('id', cardId)
          .single();
        if (cardErr || !card) throw new Error(cardErr?.message || 'Card not found');

        // Sign URLs for front/back so the canvas can fetch them
        setStatus('Fetching images…');
        const paths = [card.front_path, card.back_path].filter(Boolean) as string[];
        const { data: signed } = await supabase.storage.from('cards').createSignedUrls(paths, 3600);
        const frontImageUrl = signed?.find(u => u.path === card.front_path)?.signedUrl;
        const backImageUrl = signed?.find(u => u.path === card.back_path)?.signedUrl;
        if (!frontImageUrl || !backImageUrl) throw new Error('Card images not signable');

        // Resolve a custom-N style id to its saved config (needed to detect
        // Heritage custom slots and their pattern/band/grade customisations).
        let activeStyleConfig: any = null;
        let emblemFlags = { showFounderEmblem: false, showVipEmblem: false, showCardLoversEmblem: false };
        try {
          const { data: credits } = await supabase
            .from('user_credits')
            .select('custom_label_styles, is_founder, is_vip, is_card_lover, show_founder_badge, show_vip_badge, show_card_lover_badge, preferred_label_emblem')
            .single();
          if (credits) {
            emblemFlags = resolveEmblemVisibility(credits);
            if (labelStyleParam.startsWith('custom-')) {
              const styles = (credits.custom_label_styles || []) as Array<{ id: string; config: any }>;
              activeStyleConfig = styles.find(st => st.id === labelStyleParam)?.config || null;
            }
          }
        } catch { /* badges + custom styles degrade gracefully */ }
        const heritageSel = resolveHeritageSelection(labelStyleParam, activeStyleConfig);

        const labelData = getCardLabelData(card);
        const weightedScores = card.conversational_weighted_sub_scores || {};
        const subScoresData = card.conversational_sub_scores || {};
        const subScores = {
          centering: weightedScores.centering ?? subScoresData.centering?.weighted ?? 0,
          corners: weightedScores.corners ?? subScoresData.corners?.weighted ?? 0,
          edges: weightedScores.edges ?? subScoresData.edges?.weighted ?? 0,
          surface: weightedScores.surface ?? subScoresData.surface?.weighted ?? 0,
        };
        const englishName = card.featured || card.pokemon_featured || card.card_name || undefined;

        setStatus('Generating slab images…');
        // Org branding once: logos for label art, slug for QR targets (org
        // cards' QRs land on the branded storefront card page).
        const orgLogoSet = await loadLogosForCard(cardId).catch(() => null);
        const cardImageData: CardImageData = {
          cardName: labelData.primaryName,
          contextLine: labelData.contextLine,
          specialFeatures: labelData.featuresLine || undefined,
          serial: labelData.serial,
          englishName,
          grade: labelData.grade ?? 0,
          conditionLabel: labelData.condition,
          cardUrl: cardQrUrl(cardId, card.serial, orgLogoSet?.branding, `${window.location.origin}/${categoryToRouteSlug(card.category)}/${card.id}`),
          frontImageUrl,
          backImageUrl,
          showFounderEmblem: emblemFlags.showFounderEmblem,
          showVipEmblem: emblemFlags.showVipEmblem,
          showCardLoversEmblem: emblemFlags.showCardLoversEmblem,
          labelStyle: labelStyleParam,
          heritage: heritageSel.active
            ? {
                pattern: heritageSel.pattern,
                bandColors: heritageSel.bandColors ?? resolveHeritageBandColors(card.card_colors),
                gradeColors: heritageSel.gradeColors,
              }
            : undefined,
          subScores,
          logoOverrides: orgLogoSet?.branding
            ? { color: orgLogoSet.color, white: orgLogoSet.white, black: orgLogoSet.black, mark: orgLogoSet.mark, scale: orgLogoSet.logoScale }
            : undefined,
        };

        const [{ front, back }, rawImages] = await Promise.all([
          generateCardImages(cardImageData),
          generateRawCardImages(frontImageUrl, backImageUrl),
        ]);

        setStatus('Generating mini report…');
        const cardUrl = cardImageData.cardUrl;
        // Org-graded cards carry the store's logo; DCM otherwise.
        const qrCodeDataUrl = await generateQRCodeWithLogo(cardUrl, orgLogoSet?.branding ? orgLogoSet.color : undefined)
          .catch(() => generateQRCodeWithLogo(cardUrl));
        const logoDataUrl = orgLogoSet?.mark || undefined;

        const miniReportData: FoldableLabelData = {
          cardName: labelData.primaryName,
          setName: labelData.setName || '',
          cardNumber: labelData.cardNumber || undefined,
          year: labelData.year || undefined,
          specialFeatures: labelData.featuresLine || undefined,
          serial: labelData.serial,
          englishName,
          grade: labelData.grade ?? 0,
          conditionLabel: labelData.condition,
          subgrades: subScores,
          overallSummary: card.conversational_final_grade_summary || 'Card condition analysis not available.',
          qrCodeDataUrl,
          cardUrl,
          logoDataUrl,
        };
        const miniReport = await generateMiniReportJpg(miniReportData);

        if (cancelled) return;
        setStatus('Encoding images…');
        const [frontUrl2, backUrl2, miniUrl, rawFrontUrl, rawBackUrl] = await Promise.all([
          blobToDataUrl(front),
          blobToDataUrl(back),
          blobToDataUrl(miniReport),
          blobToDataUrl(rawImages.front),
          blobToDataUrl(rawImages.back),
        ]);

        if (cancelled) return;

        // eBay HTML description + pre-filled item specifics for web parity
        setStatus('Generating description and specifics…');
        const cardCategoryRaw = (card.category || 'other').toString().toLowerCase().replace(/\s+/g, '');
        // Fold sports sub-categories (Football, Baseball, ...) into 'sports'
        // and recognize every supported card type — previously yugioh/
        // starwars/sport-subcategory cards fell to 'other' and shipped
        // Non-Sport item specifics on a Sports/CCG-category listing.
        const SPORT_CATEGORIES = ['football', 'baseball', 'basketball', 'hockey', 'soccer', 'golf', 'tennis', 'wrestling', 'boxing', 'racing', 'ufc', 'mma'];
        const cardTypeForSpecifics = ['pokemon', 'sports', 'mtg', 'lorcana', 'onepiece', 'yugioh', 'starwars', 'other'].includes(cardCategoryRaw)
          ? cardCategoryRaw
          : SPORT_CATEGORIES.includes(cardCategoryRaw)
            ? 'sports'
            : 'other';
        const description = generateHtmlDescription(
          {
            primaryName: labelData.primaryName || '',
            setName: labelData.setName || '',
            cardNumber: labelData.cardNumber || '',
            grade: Math.round(labelData.grade ?? 0),
            conditionLabel: labelData.condition || '',
            overview: card.conversational_final_grade_summary || card.conversational_summary || '',
            // Whole numbers, matching the web modal (raw weighted scores can
            // carry decimals).
            subgrades: {
              centering: Math.round(subScores.centering),
              corners: Math.round(subScores.corners),
              edges: Math.round(subScores.edges),
              surface: Math.round(subScores.surface),
            },
            serial: card.org_serial_display || card.serial || 'N/A',
          },
          orgLogoSet?.branding
            ? { name: orgLogoSet.branding.name, brandColor: orgLogoSet.branding.brandColor || null }
            : null
        );
        const itemSpecifics = mapCardToItemSpecifics(card, cardTypeForSpecifics);
        const categoryId = getCategoryForCardType(cardTypeForSpecifics);

        // Generate Certificate of Analysis (DCM grading report PDF) + upload to eBay
        // as a regulatory document. Best-effort — listing still works without it.
        let regulatoryDocumentId: string | null = null;
        try {
          setStatus('Generating Certificate of Analysis…');
          const cardInfo = card.conversational_card_info || {};
          const wScores = card.conversational_weighted_sub_scores || {};
          const sScores = card.conversational_sub_scores || {};
          const centeringScore = Math.round(wScores.centering ?? sScores.centering?.weighted ?? 0);
          const cornersScore = Math.round(wScores.corners ?? sScores.corners?.weighted ?? 0);
          const edgesScore = Math.round(wScores.edges ?? sScores.edges?.weighted ?? 0);
          const surfaceScore = Math.round(wScores.surface ?? sScores.surface?.weighted ?? 0);

          let frontJpeg = '';
          let backJpeg = '';
          try { frontJpeg = await imageToJpegBase64(frontImageUrl); } catch (e) { console.warn('[CoA] front image failed:', e); }
          try { backJpeg = await imageToJpegBase64(backImageUrl); } catch (e) { console.warn('[CoA] back image failed:', e); }

          // Mirrors src/app/label-export/[cardId]/page.tsx's report data prep.
          const aiConfidence = card.conversational_image_confidence || 'N/A';
          const imageQualityMap: Record<string, string> = {
            A: 'Excellent - High confidence in grade accuracy',
            B: 'Good - Moderate confidence in grade accuracy',
            C: 'Fair - Lower confidence due to image limitations',
            D: 'Poor - Significant image quality issues affecting analysis',
          };
          const imageQuality = imageQualityMap[aiConfidence] || 'Quality assessment not available';

          const reportCardData: ReportCardData = {
            primaryName: labelData.primaryName || '',
            contextLine: (labelData as any).contextLine || (labelData as any).line2 || '',
            featuresLine: (labelData as any).featuresLine || (labelData as any).line3 || null,
            serial: card.serial,
            grade: labelData.grade ?? 0,
            gradeFormatted: (labelData.grade ?? 0) % 1 === 0 ? String(labelData.grade ?? 0) : (labelData.grade ?? 0).toFixed(1),
            condition: labelData.condition || getConditionLabel(labelData.grade ?? 0),
            cardName: cardInfo.card_name || card.card_name || '',
            playerName: cardInfo.player_or_character || card.featured || card.pokemon_featured || '',
            setName: cardInfo.set_name || card.card_set || '',
            year: cardInfo.year || '',
            manufacturer: cardInfo.manufacturer || '',
            cardNumber: cardInfo.card_number || card.card_number || '',
            sport: card.category || 'Other',
            frontImageUrl: frontJpeg,
            backImageUrl: backJpeg,
            conditionLabel: labelData.condition || getConditionLabel(labelData.grade ?? 0),
            labelCondition: labelData.condition || getConditionLabel(labelData.grade ?? 0),
            gradeRange: card.conversational_grade_uncertainty || '±0.5',
            heritage: heritageSel.active
              ? { pattern: heritageSel.pattern, bandColors: heritageSel.bandColors ?? resolveHeritageBandColors(card.card_colors), gradeColors: heritageSel.gradeColors }
              : undefined,
            org: orgLogoSet?.branding
              ? { name: orgLogoSet.branding.name, slug: orgLogoSet.branding.slug, logoDataUrl: orgLogoSet.mark || null, brandColor: orgLogoSet.branding.brandColor || null }
              : undefined,
            professionalGrades: {
              psa: card.estimated_professional_grades?.psa?.grade || '-',
              bgs: card.estimated_professional_grades?.bgs?.grade || '-',
              sgc: card.estimated_professional_grades?.sgc?.grade || '-',
              cgc: card.estimated_professional_grades?.cgc?.grade || '-',
            },
            subgrades: {
              centering: { score: centeringScore, summary: sScores.centering?.notes || 'Centering assessed', frontScore: sScores.centering?.front ?? centeringScore, backScore: sScores.centering?.back ?? centeringScore, frontSummary: '', backSummary: '' },
              corners: { score: cornersScore, summary: sScores.corners?.notes || 'Corners assessed', frontScore: sScores.corners?.front ?? cornersScore, backScore: sScores.corners?.back ?? cornersScore, frontSummary: '', backSummary: '' },
              edges: { score: edgesScore, summary: sScores.edges?.notes || 'Edges assessed', frontScore: sScores.edges?.front ?? edgesScore, backScore: sScores.edges?.back ?? edgesScore, frontSummary: '', backSummary: '' },
              surface: { score: surfaceScore, summary: sScores.surface?.notes || 'Surface assessed', frontScore: sScores.surface?.front ?? surfaceScore, backScore: sScores.surface?.back ?? surfaceScore, frontSummary: '', backSummary: '' },
            },
            specialFeatures: {
              autographed: cardInfo.autographed || false,
              serialNumbered: cardInfo.serial_number || undefined,
              subset: cardInfo.subset || undefined,
            },
            aiConfidence,
            imageQuality,
            overallSummary: card.conversational_final_grade_summary || undefined,
            generatedDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
            reportId: String(card.id).substring(0, 8).toUpperCase(),
            cardDetails: (labelData as any).contextLine || '',
            specialFeaturesString: (labelData as any).featuresLine || '',
            cardUrl,
            qrCodeDataUrl,
          };

          const pdfDoc = pdf(<CardGradingReport cardData={reportCardData} />);
          const pdfBlob = await pdfDoc.toBlob();

          setStatus('Uploading certificate…');
          const formData = new FormData();
          formData.append('file', pdfBlob, `DCM-Report-${card.serial}.pdf`);
          formData.append('fileName', `DCM-Report-${card.serial}.pdf`);
          const docRes = await fetch('/api/ebay/document', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          });
          if (docRes.ok) {
            const docJson = await docRes.json();
            regulatoryDocumentId = docJson.documentId || null;
            console.log('[CoA] uploaded, documentId:', regulatoryDocumentId);
          } else {
            const txt = await docRes.text().catch(() => '');
            console.warn('[CoA] upload failed:', docRes.status, txt);
          }
        } catch (err) {
          console.warn('[CoA] generation failed (non-fatal):', err);
        }

        setStatus('Done');
        const images = {
          front: frontUrl2,
          back: backUrl2,
          miniReport: miniUrl,
          rawFront: rawFrontUrl,
          rawBack: rawBackUrl,
        };
        if (chunkedBridge) {
          // Chunked protocol (v2): one bridge message per image so no single
          // postMessage carries all ~5 base64 PNGs at once, then a small
          // completion message with the metadata.
          const entries = Object.entries(images);
          entries.forEach(([key, dataUrl], index) => {
            postToRN({ type: 'ebay-prep-image', key, dataUrl, index, total: entries.length });
          });
          postToRN({
            type: 'ebay-prep-complete',
            description,
            itemSpecifics,
            categoryId,
            regulatoryDocumentId,
          });
        } else {
          // Legacy protocol: single message with everything (old app builds).
          postToRN({
            type: 'images-ready',
            images,
            description,
            itemSpecifics,
            categoryId,
            regulatoryDocumentId,
          });
        }
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
  }, [cardId, token, labelStyleParam, chunkedBridge]);

  return (
    <div style={{ padding: 16, fontFamily: 'system-ui, sans-serif', fontSize: 14, color: '#374151' }}>
      <p>{status}</p>
      {error && <p style={{ color: '#dc2626' }}>Error: {error}</p>}
    </div>
  );
}
