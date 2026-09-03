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
 * Query params: ?token= (required, the Supabase access token), ?labelStyle=
 * (modern | traditional | heritage | custom-1..4, default modern), ?bridge=2
 * (opt into the chunked protocol below), ?docs=0 (skip the Certificate of
 * Analysis — its PDF render and its eBay upload — and report
 * regulatoryDocumentId: null; used by the BULK photo pass, which never attaches
 * documents). Unknown params are ignored, and both protocols stay backward
 * compatible: old app bundles keep hitting this page.
 *
 * Bridge protocols (selected by the ?bridge query param):
 * - bridge=2 (chunked): one { type: 'ebay-prep-image', key, dataUrl, index,
 *   total } message per image, then a final { type: 'ebay-prep-complete',
 *   title, description, itemSpecifics, categoryId, regulatoryDocumentId }
 *   message. Requested by new app builds — a single ~10 MB postMessage is
 *   copied whole across the RN bridge and can jank/OOM low-end Android
 *   devices.
 * - legacy (no param): one { type: 'images-ready', images: {…5 data URLs},
 *   …the same metadata } message. Kept for old app builds that predate the
 *   chunked handler; they load this page without ?bridge.
 * - on failure: { type: 'error', message }.
 *
 * `title` is additive (older bundles build their own title and ignore it);
 * `itemSpecifics` rows keep their { name, value, required, editable } shape —
 * the aspect rows merged in from eBay's Taxonomy API are the same shape, so a
 * bundle that already renders `required` marks them without a change.
 */

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { generateCardImages, generateRawCardImages, type CardImageData } from '@/lib/cardImageGenerator';
import { generateMiniReportJpg } from '@/lib/miniReportJpgGenerator';
import { generateQRCodeWithLogo, type FoldableLabelData } from '@/lib/foldableLabelGenerator';
import { loadLogosForCard, cardQrUrl } from '@/lib/orgBranding';
import { type ListingBranding } from '@/lib/ebay/listingDescription';
import { getCardLabelData } from '@/lib/useLabelData';
import { categoryToRouteSlug } from '@/lib/postGradeEmailTemplates';
import { resolveEmblemVisibility } from '@/lib/labelEmblems';
import { resolveHeritageSelection } from '@/lib/labels/labelStyleResolution';
import { resolveHeritageBandColors } from '@/lib/labelLab/heritageLayout';
import { getCategoryForCardType } from '@/lib/ebay/itemSpecifics';
import { normalizeListingCategory } from '@/lib/ebay/listingFields';
import {
  buildListingDraft,
  type EbayAspect,
  type ListingDefaultsPayload,
} from '@/lib/ebay/listingDraft';
import { compressListingImage, DEFAULT_IMAGE_ORDER, type SystemImageKey } from '@/lib/ebay/prepareListingImages';
import { pdf } from '@react-pdf/renderer';
import { CardGradingReport, type ReportCardData } from '@/components/reports/CardGradingReport';
// Canonical grade -> condition label, shared with labelDataGenerator.
//
// This replaced a private copy in this file that had the wrong scale at the top:
// it inserted "Pristine" at 10, pushing "Gem Mint" down to 9 and dropping "Mint".
// It never reached a listing. Every call site reads `labelData.condition ||
// getConditionLabel(grade)`, and labelDataGenerator.getCondition() has always used
// the canonical mapping, so the stored condition wins and the local copy only ever
// stood in for a card with no label condition at all.
//
// Collapsed anyway: one rule living in three places is free to drift, and two of
// the three had already drifted.
import { getConditionFromGrade as getConditionLabel } from '@/lib/conditionAssessment';
import { getUncertaintyFromConfidence } from '@/lib/gradeDisplayUtils';

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
  // ?docs=0 — skip the Certificate of Analysis entirely and report
  // regulatoryDocumentId: null. The BULK drain does not attach documents to a
  // listing, so for a 100-card batch the CoA is 100 PDF renders and 100 wasted
  // eBay document uploads. Opt-IN by absence: no param means the old behaviour,
  // so every app bundle already in the wild is unaffected.
  const skipDocuments = searchParams.get('docs') === '0';
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
          orgDesign: orgLogoSet?.design ?? null,
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
        // Compress before encoding, exactly as the web upload path does
        // (1600 px long side, <= 1 MB). Native used to post full-size canvas
        // PNGs across the bridge and then straight to /api/ebay/images, so a
        // mobile listing carried heavier photos than the same card listed on
        // the web — and the base64 payload was several times larger.
        const encode = async (blob: Blob) => blobToDataUrl(await compressListingImage(blob));
        const [frontUrl2, backUrl2, miniUrl, rawFrontUrl, rawBackUrl] = await Promise.all([
          encode(front),
          encode(back),
          encode(miniReport),
          encode(rawImages.front),
          encode(rawImages.back),
        ]);

        if (cancelled) return;

        // eBay title, HTML description + pre-filled item specifics.
        //
        // This used to be a parallel assembly that had already drifted from the
        // web modal (no headline, a hardcoded 'DCM' keyword label, no eBay
        // aspects). It now calls the same buildListingDraft the modal and the
        // bulk drain seed from, so all three surfaces agree by construction.
        setStatus('Generating description and specifics…');
        // The SHARED normalizer, not a local allow-list: this page's copy only
        // stripped spaces, so 'Yu-Gi-Oh' stayed 'yu-gi-oh', missed the list and
        // shipped Non-Sport item specifics on a CCG listing. normalizeListingCategory
        // strips every non-alphanumeric and folds the sports sub-categories in.
        const cardTypeForSpecifics = normalizeListingCategory(card.category);
        const listingBranding: ListingBranding | null = orgLogoSet?.branding
          ? { name: orgLogoSet.branding.name, brandColor: orgLogoSet.branding.brandColor || null }
          : null;

        // Saved defaults (web parity with EbayListingModal): the user's/store's
        // description template replaces the standard layout entirely, and the
        // store's titleGradeLabel is the brand the description's keyword
        // sentence and headline grade tail carry ("Kings Kards 9", not
        // "DCM 9"). Mobile gets both from this page, so without the fetch the
        // template was dropped and the label silently fell back to 'DCM'.
        //
        // Aspects: eBay's required + recommended aspects for the category, the
        // same list the modal merges on its Specifics step. Required rows the
        // card data cannot fill have to exist for the wizard to mark them with
        // an asterisk — without them native shipped listings missing aspects
        // eBay requires.
        //
        // Both are best-effort and run together; either failing leaves the
        // standard layout / our own mapped specifics rather than no listing.
        // Auth: the same ?token access token the page already uses for
        // Supabase and the CoA upload.
        const categoryId = getCategoryForCardType(cardTypeForSpecifics);
        const authHeaders = { Authorization: `Bearer ${token}` };
        const [listingDefaults, aspects] = await Promise.all([
          fetch('/api/ebay/listing-defaults', { headers: authHeaders })
            .then(r => (r.ok ? (r.json() as Promise<ListingDefaultsPayload>) : null))
            .catch(err => {
              console.warn('[eBay Image Prep] listing defaults fetch failed (non-fatal):', err);
              return null;
            }),
          fetch(`/api/ebay/aspects?category_id=${encodeURIComponent(categoryId)}`, { headers: authHeaders })
            .then(async r => (r.ok ? ((await r.json()).aspects as EbayAspect[]) || null : null))
            .catch(err => {
              console.warn('[eBay Image Prep] aspects fetch failed (non-fatal):', err);
              return null;
            }),
        ]);

        if (cancelled) return;
        const draft = buildListingDraft(card, {
          cardType: cardTypeForSpecifics,
          listingDefaults,
          branding: listingBranding,
          aspects,
        });
        // The title is built here only so the description can repeat it as its
        // headline (and so the grade tail carries the store's label). The app
        // still builds the title it shows from its own twin builder.
        const { title, descriptionHtml: description, itemSpecifics } = draft;

        // Generate Certificate of Analysis (DCM grading report PDF) + upload to eBay
        // as a regulatory document. Best-effort — listing still works without it.
        let regulatoryDocumentId: string | null = null;
        if (skipDocuments) {
          // ?docs=0 — the caller does not attach documents (the bulk drain
          // doesn't), so neither the PDF render nor the eBay upload is worth
          // doing. regulatoryDocumentId stays null, which is exactly what a
          // failed CoA reports anyway, so nothing downstream changes.
          console.log('[CoA] skipped (docs=0)');
        } else try {
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
            // Derived from the confidence letter, like the web listing modal
            // and the PDF reports. '±0.5' was not a value on the rubric's
            // scale (A=±0, B=±1, C=±2, D=±3), and this image is public.
            gradeRange: getUncertaintyFromConfidence(card.conversational_image_confidence),
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

          // marketplaceSafe: uploaded to eBay as a regulatory document, so it
          // must not name another grading company anywhere.
          const pdfDoc = pdf(<CardGradingReport cardData={reportCardData} marketplaceSafe />);
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
        const images: Record<SystemImageKey, string> = {
          front: frontUrl2,
          back: backUrl2,
          miniReport: miniUrl,
          rawFront: rawFrontUrl,
          rawBack: rawBackUrl,
        };
        if (chunkedBridge) {
          // Chunked protocol (v2): one bridge message per image so no single
          // postMessage carries all ~5 base64 images at once, then a small
          // completion message with the metadata. Sent in the shared gallery
          // order (labelled front first) rather than object-literal order —
          // the app keys them by `key`, so this is purely so the chunk stream
          // matches DEFAULT_IMAGE_ORDER.
          const keys = DEFAULT_IMAGE_ORDER.filter(
            (i): i is { kind: 'system'; key: SystemImageKey } => i.kind === 'system'
          ).map(i => i.key);
          keys.forEach((key, index) => {
            postToRN({ type: 'ebay-prep-image', key, dataUrl: images[key], index, total: keys.length });
          });
          postToRN({
            type: 'ebay-prep-complete',
            title,
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
            title,
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
  }, [cardId, token, labelStyleParam, chunkedBridge, skipDocuments]);

  return (
    <div style={{ padding: 16, fontFamily: 'system-ui, sans-serif', fontSize: 14, color: '#374151' }}>
      <p>{status}</p>
      {error && <p style={{ color: '#dc2626' }}>Error: {error}</p>}
    </div>
  );
}
