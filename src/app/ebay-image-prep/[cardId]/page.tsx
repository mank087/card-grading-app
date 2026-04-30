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
 */

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { generateCardImages, generateRawCardImages, type CardImageData } from '@/lib/cardImageGenerator';
import { generateMiniReportJpg } from '@/lib/miniReportJpgGenerator';
import { generateQRCodeWithLogo, loadLogoAsBase64, type FoldableLabelData } from '@/lib/foldableLabelGenerator';
import { getCardLabelData } from '@/lib/useLabelData';
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

// Mirrors generateHtmlDescription in EbayListingModal.tsx so mobile listings
// match web parity for the eBay description body.
function generateHtmlDescription(data: {
  primaryName: string; setName: string; cardNumber: string;
  grade: number; conditionLabel: string; overview: string;
  subgrades: { centering: number; corners: number; edges: number; surface: number };
  serial: string;
}): string {
  const { primaryName, setName, cardNumber, grade, conditionLabel, overview, subgrades, serial } = data;
  const gradeColor = getGradeColor(grade);
  const dcmPurple = '#7C3AED';
  const dcmPurpleLight = '#A78BFA';
  const dcmGray = '#4B5563';
  return `
<div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, ${dcmPurple} 0%, #5B21B6 100%); color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
    <h2 style="margin: 0 0 8px 0; font-size: 24px;">DCM Graded Card</h2>
    <p style="margin: 0; opacity: 0.9; font-size: 14px;">Professional AI-Powered Card Grading</p>
  </div>
  <div style="background: #F9FAFB; border: 2px solid ${gradeColor}; border-radius: 12px; padding: 20px; margin-bottom: 20px; text-align: center;">
    <div style="font-size: 48px; font-weight: bold; color: ${gradeColor};">${grade}</div>
    <div style="font-size: 18px; color: ${dcmGray}; font-weight: 600;">${conditionLabel}</div>
    <div style="font-size: 12px; color: #9CA3AF; margin-top: 8px;">DCM Serial: <strong>${serial}</strong></div>
  </div>
  <div style="background: white; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
    <h3 style="color: ${dcmPurple}; margin: 0 0 16px 0; font-size: 18px; border-bottom: 2px solid ${dcmPurpleLight}; padding-bottom: 8px;">Card Details</h3>
    <table style="width: 100%; border-collapse: collapse;">
      ${primaryName ? `<tr><td style="padding: 8px 0; color: ${dcmGray}; font-weight: 600;">Character/Player:</td><td style="padding: 8px 0; text-align: right;">${primaryName}</td></tr>` : ''}
      ${setName ? `<tr><td style="padding: 8px 0; color: ${dcmGray}; font-weight: 600;">Set:</td><td style="padding: 8px 0; text-align: right;">${setName}</td></tr>` : ''}
      ${cardNumber ? `<tr><td style="padding: 8px 0; color: ${dcmGray}; font-weight: 600;">Card Number:</td><td style="padding: 8px 0; text-align: right;">#${cardNumber}</td></tr>` : ''}
    </table>
  </div>
  ${overview ? `
  <div style="background: white; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
    <h3 style="color: ${dcmPurple}; margin: 0 0 16px 0; font-size: 18px; border-bottom: 2px solid ${dcmPurpleLight}; padding-bottom: 8px;">Condition Overview</h3>
    <p style="color: ${dcmGray}; line-height: 1.6; margin: 0;">${overview}</p>
  </div>` : ''}
  <div style="background: white; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
    <h3 style="color: ${dcmPurple}; margin: 0 0 16px 0; font-size: 18px; border-bottom: 2px solid ${dcmPurpleLight}; padding-bottom: 8px;">DCM Sub-Grades</h3>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 12px 8px; text-align: center; background: #F9FAFB; border-radius: 8px 0 0 8px;">
          <div style="font-size: 24px; font-weight: bold; color: ${getGradeColor(subgrades.centering)};">${subgrades.centering}</div>
          <div style="font-size: 12px; color: ${dcmGray};">Centering</div>
        </td>
        <td style="padding: 12px 8px; text-align: center; background: #F9FAFB;">
          <div style="font-size: 24px; font-weight: bold; color: ${getGradeColor(subgrades.corners)};">${subgrades.corners}</div>
          <div style="font-size: 12px; color: ${dcmGray};">Corners</div>
        </td>
        <td style="padding: 12px 8px; text-align: center; background: #F9FAFB;">
          <div style="font-size: 24px; font-weight: bold; color: ${getGradeColor(subgrades.edges)};">${subgrades.edges}</div>
          <div style="font-size: 12px; color: ${dcmGray};">Edges</div>
        </td>
        <td style="padding: 12px 8px; text-align: center; background: #F9FAFB; border-radius: 0 8px 8px 0;">
          <div style="font-size: 24px; font-weight: bold; color: ${getGradeColor(subgrades.surface)};">${subgrades.surface}</div>
          <div style="font-size: 12px; color: ${dcmGray};">Surface</div>
        </td>
      </tr>
    </table>
  </div>
  <div style="background: linear-gradient(135deg, ${dcmPurple} 0%, #5B21B6 100%); color: white; padding: 16px 20px; border-radius: 8px; text-align: center;">
    <div style="font-size: 18px; font-weight: bold;">Graded by DCM</div>
    <p style="margin: 8px 0 0 0; font-size: 12px; opacity: 0.9;">Professional AI-Powered Card Authentication & Grading</p>
    <p style="margin: 4px 0 0 0; font-size: 11px; opacity: 0.7;">Verify this card at dcmgrading.com</p>
  </div>
</div>`.trim();
}

export default function EbayImagePrepPage() {
  const { cardId } = useParams<{ cardId: string }>();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const labelStyleParam = (searchParams.get('labelStyle') || 'modern') as
    | 'modern' | 'traditional' | 'custom-1' | 'custom-2' | 'custom-3' | 'custom-4';
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
        const cardImageData: CardImageData = {
          cardName: labelData.primaryName,
          contextLine: labelData.contextLine,
          specialFeatures: labelData.featuresLine || undefined,
          serial: labelData.serial,
          englishName,
          grade: labelData.grade ?? 0,
          conditionLabel: labelData.condition,
          cardUrl: `${window.location.origin}/${(card.category || 'other').toLowerCase().replace(' ', '')}/${card.id}`,
          frontImageUrl,
          backImageUrl,
          showFounderEmblem: false,
          labelStyle: labelStyleParam,
          subScores,
        };

        const [{ front, back }, rawImages] = await Promise.all([
          generateCardImages(cardImageData),
          generateRawCardImages(frontImageUrl, backImageUrl),
        ]);

        setStatus('Generating mini report…');
        const cardUrl = cardImageData.cardUrl;
        const [qrCodeDataUrl, logoDataUrl] = await Promise.all([
          generateQRCodeWithLogo(cardUrl),
          loadLogoAsBase64().catch(() => undefined),
        ]);

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
        const cardTypeForSpecifics = ['pokemon','sports','mtg','lorcana','onepiece','other'].includes(cardCategoryRaw)
          ? cardCategoryRaw
          : 'other';
        const description = generateHtmlDescription({
          primaryName: labelData.primaryName || '',
          setName: labelData.setName || '',
          cardNumber: labelData.cardNumber || '',
          grade: Math.round(labelData.grade ?? 0),
          conditionLabel: labelData.condition || '',
          overview: card.conversational_final_grade_summary || card.conversational_summary || '',
          subgrades: subScores,
          serial: card.serial || 'N/A',
        });
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
            gradedAt: card.graded_at || card.created_at || new Date().toISOString(),
            qrCodeUrl: qrCodeDataUrl,
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
        postToRN({
          type: 'images-ready',
          images: {
            front: frontUrl2,
            back: backUrl2,
            miniReport: miniUrl,
            rawFront: rawFrontUrl,
            rawBack: rawBackUrl,
          },
          description,
          itemSpecifics,
          categoryId,
          regulatoryDocumentId,
        });
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
  }, [cardId, token, labelStyleParam]);

  return (
    <div style={{ padding: 16, fontFamily: 'system-ui, sans-serif', fontSize: 14, color: '#374151' }}>
      <p>{status}</p>
      {error && <p style={{ color: '#dc2626' }}>Error: {error}</p>}
    </div>
  );
}
