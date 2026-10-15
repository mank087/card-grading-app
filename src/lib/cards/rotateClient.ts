/**
 * Client call for the owner's "turn this photo" control (Oct 2026).
 * Posts to /api/cards/[id]/rotate and returns the fresh signed URLs for the
 * turned face so the page can swap the image without a reload.
 */
import { getStoredSession } from '@/lib/directAuth';

export type RotateFace = 'front' | 'back';

export interface RotateResult {
  face: RotateFace;
  rotation: number;
  url: string | null;
  thumb_url: string | null;
  width: number;
  height: number;
}

export async function rotateCardPhoto(cardId: string, face: RotateFace, direction: 'cw' | 'ccw' = 'cw'): Promise<RotateResult> {
  const session = getStoredSession();
  if (!session?.access_token) throw new Error('Sign in to turn a photo.');
  const res = await fetch(`/api/cards/${cardId}/rotate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ face, direction }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || 'Could not turn the photo.');
  return body as RotateResult;
}
