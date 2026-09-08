import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { verifyAuth } from '@/lib/serverAuth';
import { supabaseServer } from '@/lib/supabaseServer';
import { isUuid } from '@/lib/uuid';

const schema = z.object({ reviewId: z.string().uuid(), decision: z.enum(['accept', 'keep_original']) }).strict();
const headers = { 'Cache-Control': 'private, no-store' };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) return json({ error: 'Please sign in.' }, 401);
    if (process.env.GRADE_REVIEW_ENABLED !== 'true' && process.env.GRADE_REVIEW_HISTORY_ENABLED !== 'true') {
      return json({ error: 'Grade reviews are not available.' }, 503);
    }
    const { id } = await params;
    if (!isUuid(id)) return json({ error: 'Card not found.' }, 404);
    const text = await request.text();
    if (text.length > 1000) return json({ error: 'Invalid decision.' }, 400);
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { return json({ error: 'Invalid decision.' }, 400); }
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return json({ error: 'Invalid decision.' }, 400);
    const { data, error } = await supabaseServer().rpc('decide_own_grade_review', {
      p_card_id: id, p_review_id: parsed.data.reviewId, p_user_id: auth.userId, p_decision: parsed.data.decision,
    });
    if (error) {
      if (error.message.includes('review_not_available')) return json({ error: 'Review not found.' }, 404);
      throw error;
    }
    if (!data || data.stale) return json({ error: 'This proposal is no longer available. Refresh the card to see its current result.' }, 409);
    if (data.accepted) {
      for (const category of ['sports', 'pokemon', 'mtg', 'lorcana', 'other', 'yugioh', 'onepiece', 'starwars']) revalidatePath(`/${category}/${id}`);
      revalidatePath('/collection');
    }
    return json({ accepted: data.accepted });
  } catch {
    return json({ error: 'Unable to confirm your decision. You can safely try the same choice again.' }, 503);
  }
}
