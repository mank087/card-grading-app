'use client';

/**
 * The card detail data layer, category-agnostic.
 *
 * EXTRACTED FROM `src/app/pokemon/[id]/CardDetailClient.tsx`, with the sports
 * client (`src/app/sports/[id]/CardDetailClient.tsx`) diffed line for line to
 * confirm the behaviour is shared. The eight legacy clients are frozen for the
 * whole redesign (docs/PLAN_CARD_DETAIL_REDESIGN_2026-09-21.md §4), so V2 owns
 * a copy; mirror any fix made to the legacy pages here. Pokemon line ranges as
 * of 2026-09-21 (sports equivalents in brackets):
 *
 *   state declarations            1520-1614   [1526-1620]
 *   fetch + 429 retry/poll        1616-1736   [1772-1888]
 *   mount fetch effect            1739-1744   [1893-1900]
 *   org branding logos            1755-1769   [1909-1925]
 *   emblem flags                  1771-1802   [1927-1957]
 *   handleRegradeClick            1915-1921   [2071-2077]
 *   regradeCard                   1924-2031   [2080-2185]
 *   deleteCard                    2032-2073   [2187-2226]
 *   toggleVisibility              2075-2118   [2228-2271]
 *
 * The ONLY differences between the two clients in this region are the category
 * token in the API path and the result URL, and the grading-queue label; both
 * are parameters here.
 *
 * SCOPE: data only. UI state (modals, tabs, zoom, hover, tour/first-grade
 * flags) stays in the component, as does defect parsing.
 *
 * OWNERSHIP is computed exactly as legacy does it — a client-side compare of
 * the localStorage session against card.user_id, with the API taking a
 * client-supplied user_id. That is open code-audit gap G6. This hook
 * reproduces it and must not be used to justify a new owner-only surface
 * without a server check.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { readIncompleteInspectionMessage } from '@/lib/grading/inspectionMessage';
import { getStoredSession } from '@/lib/directAuth';
import { fetchBrandingForCard } from '@/lib/orgBranding';
import type { OrgLabelDesign } from '@/lib/labels/orgLabelDesign';
import { useGradingQueue } from '@/contexts/GradingQueueContext';
import { useCredits } from '@/contexts/CreditsContext';
import type { CardDetailCategory } from '@/lib/featureFlags/cardDetailV2';

/**
 * The grading-queue label legacy passes for a re-grade. Pokemon sends
 * "Pokemon Card (Re-grade)", sports "Sports Card (Re-grade)"; the rest follow
 * the same shape in their own clients.
 */
const REGRADE_QUEUE_LABEL: Record<CardDetailCategory, string> = {
  pokemon: 'Pokemon Card (Re-grade)',
  sports: 'Sports Card (Re-grade)',
  mtg: 'MTG Card (Re-grade)',
  lorcana: 'Lorcana Card (Re-grade)',
  onepiece: 'One Piece Card (Re-grade)',
  yugioh: 'Yu-Gi-Oh Card (Re-grade)',
  starwars: 'Star Wars Card (Re-grade)',
  other: 'Card (Re-grade)',
};

/** The fields this hook itself reads. The row carries far more; select('*'). */
export interface CardDetailRecord {
  id: string;
  user_id?: string | null;
  front_url?: string | null;
  back_url?: string | null;
  visibility?: 'public' | 'private' | null;
  org_id?: string | null;
  owner_is_founder?: boolean | null;
  owner_show_founder_badge?: boolean | null;
  owner_is_vip?: boolean | null;
  owner_show_vip_badge?: boolean | null;
  owner_is_card_lover?: boolean | null;
  owner_show_card_lover_badge?: boolean | null;
  owner_preferred_label_emblem?: string | null;
  [key: string]: any;
}

/**
 * True when the card has a finished numeric grade. The row has no `grade`
 * column: the whole grade lives in dcm_grade_whole, with
 * conversational_whole_grade as the fallback. Checking `card.grade` (as the
 * page used to) was always false, which silently disabled every post-grade
 * prompt on this page.
 */
export function isCardGradeComplete(card: CardDetailRecord | null | undefined): boolean {
  if (!card) return false;
  const raw = card.dcm_grade_whole ?? card.conversational_whole_grade;
  const n = typeof raw === 'string' ? Number(raw) : raw;
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

export interface OrgLogos {
  color: string | null;
  white: string | null;
  mark: string | null;
  scale: number;
  design: OrgLabelDesign | null;
}

export interface EmblemFlags {
  showFounderEmblem: boolean;
  showVipEmblem: boolean;
  showCardLoversEmblem: boolean;
}

export interface UseCardDetailResult {
  card: CardDetailRecord | null;
  loading: boolean;
  /** True while the API is answering 429 and the retry loop is running. */
  isProcessing: boolean;
  error: string | null;
  /** Front image kept on screen during a re-grade, as the legacy animation does. */
  regradingImageUrl: string | null;
  refetch: () => Promise<void>;

  isOwner: boolean;
  visibility: 'public' | 'private';
  isTogglingVisibility: boolean;
  toggleVisibility: () => Promise<void>;

  isDeleting: boolean;
  deleteCard: () => Promise<void>;

  /** False when the balance is under 1 credit — legacy's insufficient-credits gate. */
  canRegrade: boolean;
  regradeCard: () => Promise<void>;

  emblems: EmblemFlags;
  orgLogos: OrgLogos | null;
}

export function useCardDetail(
  category: CardDetailCategory,
  cardId: string
): UseCardDetailResult {
  const router = useRouter();
  const { addToQueue, updateCardStatus } = useGradingQueue();
  const { balance, deductLocalCredit } = useCredits();

  const [card, setCard] = useState<CardDetailRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regradingImageUrl, setRegradingImageUrl] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [isTogglingVisibility, setIsTogglingVisibility] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [orgLogos, setOrgLogos] = useState<OrgLogos | null>(null);
  const [showFounderEmblem, setShowFounderEmblem] = useState(false);
  const [showVipEmblem, setShowVipEmblem] = useState(false);
  const [showCardLoversEmblem, setShowCardLoversEmblem] = useState(false);

  const fetchCardDetails = useCallback(async () => {
    if (!cardId) return;

    try {
      setLoading(true);
      setError(null);
      setIsProcessing(false);

      // Session supplies user_id so the owner can read a private card.
      const session = getStoredSession();
      const userParam = session?.user?.id ? `&user_id=${session.user.id}` : '';

      const res = await fetch(`/api/${category}/${cardId}?t=${Date.now()}${userParam}`); // Cache-busting

      if (!res.ok) {
        const incompleteMessage = await readIncompleteInspectionMessage(res);
        if (incompleteMessage) {
          setError(incompleteMessage);
          setLoading(false);
          setIsProcessing(false);
          return;
        }

        // Private card, access denied.
        if (res.status === 403) {
          setError('PRIVATE_CARD');
          setLoading(false);
          return;
        }

        // Alteration error.
        if (res.status === 400) {
          const errorData = await res.json();
          if (errorData.error === 'CARD_ALTERED') {
            setError(`CARD ALTERED: ${errorData.details || 'This card has been altered and cannot be graded.'}\n\n${errorData.recommendation || ''}`);
            setLoading(false);
            setCard({
              ...errorData,
              is_altered: true,
              alteration_detected: true
            } as CardDetailRecord);
            return;
          }
        }

        if (res.status === 429) {
          // Still grading. Poll with a growing delay while the page shows the
          // processing state.
          setIsProcessing(true);
          setLoading(false);

          const retryWithBackoff = async (attempt: number = 1): Promise<void> => {
            if (attempt > 5) {
              setError('Processing is taking longer than expected. The card analysis is still running in the background.');
              setIsProcessing(false);
              return;
            }

            const delay = 3000 * attempt; // 3s, 6s, 9s, 12s, 15s

            await new Promise(resolve => setTimeout(resolve, delay));

            try {
              const retryRes = await fetch(`/api/${category}/${cardId}?t=${Date.now()}${userParam}`); // Cache-busting

              if (retryRes.ok) {
                const data = await retryRes.json();
                setCard(data);
                setVisibility(data.visibility || 'private');
                setIsProcessing(false);
                return;
              }

              const incompleteMessage = await readIncompleteInspectionMessage(retryRes);
              if (incompleteMessage) {
                setError(incompleteMessage);
                setIsProcessing(false);
                return;
              }
              if (retryRes.status === 429) {
                // Still processing, continue retrying
                await retryWithBackoff(attempt + 1);
              } else {
                throw new Error(`Failed to load card: ${retryRes.status}`);
              }
            } catch {
              await retryWithBackoff(attempt + 1);
            }
          };

          await retryWithBackoff();
          return;
        }
        throw new Error(`Failed to load card: ${res.status}`);
      }

      const data = await res.json();
      setCard(data);
      setVisibility(data.visibility || 'private');

    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [category, cardId]);

  // Single fetch on mount.
  useEffect(() => {
    if (cardId) {
      fetchCardDetails();
    }
  }, [cardId, fetchCardDetails]);

  // Enterprise org branding — org-graded cards show the store's logo on the
  // on-screen labels (color logo on light labels, white on the dark modern one).
  useEffect(() => {
    if (!card?.org_id || !card?.id) { setOrgLogos(null); return; }
    let cancelled = false;
    fetchBrandingForCard(card.id).then((b) => {
      if (!cancelled) setOrgLogos(b ? {
        color: b.logoUrl,
        white: b.logoWhiteUrl,
        // Brand Setup picks WHICH variant prints on the mark and how big.
        mark: (b.logoVariant === 'white' ? b.logoWhiteUrl : b.logoVariant === 'black' ? b.logoBlackUrl : b.logoUrl) ?? b.logoUrl,
        scale: b.logoScale && b.logoScale > 0 ? b.logoScale : 1,
        design: b.design ?? null,
      } : null);
    });
    return () => { cancelled = true; };
  }, [card]);

  // ⭐ Emblems follow the card OWNER's settings and preference, not the viewer's.
  // New format: comma-separated list of selected emblems ("founder,vip").
  useEffect(() => {
    const preference = card?.owner_preferred_label_emblem || '';
    const isFounder = card?.owner_is_founder && card?.owner_show_founder_badge;
    const isVip = card?.owner_is_vip && card?.owner_show_vip_badge;
    const isCardLover = card?.owner_is_card_lover && card?.owner_show_card_lover_badge;

    // Handle legacy 'none' value
    if (preference === 'none') {
      setShowFounderEmblem(false);
      setShowVipEmblem(false);
      setShowCardLoversEmblem(false);
      return;
    }

    const selectedEmblems = preference ? preference.split(',') : [];

    // No preference set: show all available emblems (legacy 'both'/'auto').
    if (selectedEmblems.length === 0 || preference === 'both' || preference === 'auto') {
      setShowFounderEmblem(!!isFounder);
      setShowVipEmblem(!!isVip);
      setShowCardLoversEmblem(!!isCardLover);
    } else {
      // Array format: show only emblems selected AND earned.
      setShowFounderEmblem(selectedEmblems.includes('founder') && !!isFounder);
      setShowVipEmblem(selectedEmblems.includes('vip') && !!isVip);
      setShowCardLoversEmblem(selectedEmblems.includes('card_lover') && !!isCardLover);
    }
  }, [card?.owner_is_founder, card?.owner_show_founder_badge, card?.owner_is_vip, card?.owner_show_vip_badge, card?.owner_is_card_lover, card?.owner_show_card_lover_badge, card?.owner_preferred_label_emblem]);

  /**
   * Re-grade. The credit is deducted AFTER the grade returns, in one POST to
   * /api/stripe/deduct with { cardId, isRegrade: true } — the deduct API is
   * idempotent per card since the July 2026 duplicate-charge incident. A failed
   * deduction is logged and swallowed: the owner keeps the grade they already
   * received rather than seeing it fail after the work was done. Do not move
   * the deduction before the fetch, do not retry it, and do not add a second
   * call site.
   */
  const regradeCard = useCallback(async () => {
    let queueId: string | null = null;
    try {
      if (!card || !cardId) return;

      setRegradingImageUrl(card.front_url ?? null); // Store image URL before clearing card
      setLoading(true);
      setError(null);
      setCard(null); // Clear current card to show loading screen

      queueId = addToQueue({
        cardId: cardId,
        category,
        categoryLabel: REGRADE_QUEUE_LABEL[category],
        frontImageUrl: card.front_url ?? '',
        status: 'processing',
        resultUrl: `/${category}/${cardId}`
      });

      // Re-grading can take 30-60 seconds, so use a longer timeout.
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 120 second timeout

      const res = await fetch(`/api/${category}/${cardId}?force_regrade=true&t=${Date.now()}`, {
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to re-grade card');
      }

      const data = await res.json();

      // Deduct credit after successful re-grade.
      const session = getStoredSession();
      if (session?.access_token) {
        try {
          const creditResponse = await fetch('/api/stripe/deduct', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ cardId, isRegrade: true }),
          });

          if (creditResponse.ok) {
            deductLocalCredit();
          } else {
            console.error('[REGRADE] Failed to deduct credit:', await creditResponse.text());
          }
        } catch (creditErr) {
          console.error('[REGRADE] Credit deduction error:', creditErr);
        }
      }

      if (queueId) {
        updateCardStatus(queueId, {
          status: 'completed',
          completedAt: Date.now(),
          resultUrl: `/${category}/${cardId}`
        });
      }

      setCard(data);
      setRegradingImageUrl(null);
      setLoading(false);
    } catch (error: any) {
      console.error('Error re-grading card:', error);

      if (queueId) {
        updateCardStatus(queueId, {
          status: 'error',
          errorMessage: error.name === 'AbortError'
            ? 'Re-grading timed out'
            : (error.message || 'Failed to re-grade card')
        });
      }

      if (error.name === 'AbortError') {
        setError('Re-grading timed out (took longer than 2 minutes). Please refresh the page to see if grading completed.');
      } else {
        setError(error.message || 'Failed to re-grade card');
      }

      setRegradingImageUrl(null);
      setLoading(false);
    }
  }, [card, cardId, category, addToQueue, updateCardStatus, deductLocalCredit]);

  const deleteCard = useCallback(async () => {
    try {
      if (!card) return;

      setIsDeleting(true);

      const session = getStoredSession();
      if (!session || !session.user || !session.access_token) {
        throw new Error('You must be logged in to delete cards');
      }

      const response = await fetch(`/api/cards/${card.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to delete card');
      }

      await response.json();

      router.push('/collection');

    } catch (error: any) {
      console.error('Error deleting card:', error);
      alert(`Error deleting card: ${error.message || 'Please try again.'}`);
    } finally {
      setIsDeleting(false);
    }
  }, [card, router]);

  const toggleVisibility = useCallback(async () => {
    try {
      if (!card) return;

      const newVisibility = visibility === 'public' ? 'private' : 'public';

      setIsTogglingVisibility(true);

      const session = getStoredSession();
      if (!session || !session.user) {
        throw new Error('You must be logged in to change visibility');
      }

      const response = await fetch(`/api/cards/${card.id}/visibility`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ visibility: newVisibility }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to update visibility');
      }

      await response.json();

      setVisibility(newVisibility);

      alert(`Card is now ${newVisibility}! ${newVisibility === 'public' ? '🌐 Anyone can view and search for this card.' : '🔒 Only you can view this card. Shared links will no longer work.'}`);

    } catch (error: any) {
      console.error('Error toggling visibility:', error);
      alert(`Error updating visibility: ${error.message || 'Please try again.'}`);
    } finally {
      setIsTogglingVisibility(false);
    }
  }, [card, visibility]);

  // Legacy reads the session inline at each gating site. Reading it once per
  // card render is the same comparison against the same localStorage value.
  const isOwner = useMemo(() => {
    const session = getStoredSession();
    return !!(session?.user?.id && card?.user_id && session.user.id === card.user_id);
  }, [card]);

  return {
    card,
    loading,
    isProcessing,
    error,
    regradingImageUrl,
    refetch: fetchCardDetails,

    isOwner,
    visibility,
    isTogglingVisibility,
    toggleVisibility,

    isDeleting,
    deleteCard,

    canRegrade: balance >= 1,
    regradeCard,

    emblems: { showFounderEmblem, showVipEmblem, showCardLoversEmblem },
    orgLogos,
  };
}
