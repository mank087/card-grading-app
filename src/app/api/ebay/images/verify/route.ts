import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { getConnectionForUser, refreshTokenIfNeeded } from '@/lib/ebay/auth';
import { isOwnedListingImageUrl } from '@/lib/ebay/bulkService';
import { hostListingImages, ImageHostingError } from '@/lib/ebay/imageHosting';

export const maxDuration = 60;

/** Creates hosted photo copies only. Never claims, creates, or edits a listing. */
export async function POST(request: NextRequest) {
  const token = request.headers.get('Authorization');
  if (!token?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const supabase = supabaseServer();
    const { data: { user }, error } = await supabase.auth.getUser(token.slice(7));
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => null);
    const cardId = body?.cardId;
    const imageUrls = body?.imageUrls;
    if (typeof cardId !== 'string' || !/^[0-9a-f-]{36}$/i.test(cardId) ||
      !Array.isArray(imageUrls) || !imageUrls.length || imageUrls.length > 24 ||
      !imageUrls.every(url => {
        if (typeof url !== 'string' || /[%?#\\]/.test(url)) return false;
        try {
          const parsed = new URL(url);
          return parsed.protocol === 'https:' && !parsed.username && !parsed.password &&
            isOwnedListingImageUrl(parsed.href, user.id, cardId);
        } catch { return false; }
      })) {
      return NextResponse.json({ error: 'Select photos uploaded for this card.' }, { status: 400 });
    }
    const { data: card, error: cardError } = await supabase.from('cards')
      .select('id').eq('id', cardId).eq('user_id', user.id).maybeSingle();
    if (cardError) throw new Error('Card lookup failed');
    if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 });

    const existing = await getConnectionForUser(user.id);
    const connection = existing ? await refreshTokenIfNeeded(existing) : null;
    if (!connection) {
      return NextResponse.json({ error: 'Reconnect your eBay account.', code: 'token_refresh_failed' }, { status: 401 });
    }
    const photos = await hostListingImages({ accessToken: connection.access_token, sandbox: connection.is_sandbox }, imageUrls);
    return NextResponse.json({ photos, listingCreated: false }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof ImageHostingError) {
      return NextResponse.json({ error: error.message, code: 'photo_upload_failed', photoIndex: error.photoIndex,
        kind: error.kind, httpStatus: error.httpStatus, ebayErrorId: error.ebayErrorId },
      { status: error.kind === 'authorization' ? 401 : 502 });
    }
    return NextResponse.json({ error: 'Photo verification is unavailable. No listing was created.' }, { status: 500 });
  }
}
