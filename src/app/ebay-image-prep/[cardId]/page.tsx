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
