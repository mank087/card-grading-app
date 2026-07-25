import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/admin/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

/**
 * Slabby Lab card picker: search graded cards by name/serial (or list the
 * most recent when the query is empty). Thumbnails are short-lived signed
 * URLs — display only; the full lookup endpoint embeds durable images.
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_token')?.value
    if (!token || !(await verifyAdminSession(token))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const q = (request.nextUrl.searchParams.get('q') || '').trim()
    let query = supabaseAdmin
      .from('cards')
      .select('id, card_name, serial, category, conversational_whole_grade, conversational_condition_label, front_path, created_at')
      .not('conversational_whole_grade', 'is', null)
      .order('created_at', { ascending: false })
      .limit(12)

    if (q) {
      query = /^\d{4,}$/.test(q)
        ? query.eq('serial', q)
        : query.ilike('card_name', `%${q}%`)
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const results = await Promise.all(
      (data || []).map(async (c) => {
        let thumb: string | null = null
        if (c.front_path) {
          const { data: signed } = await supabaseAdmin.storage.from('cards').createSignedUrl(c.front_path, 600)
          thumb = signed?.signedUrl || null
        }
        return {
          id: c.id,
          name: c.card_name || '(unnamed)',
          serial: c.serial,
          category: c.category,
          grade: c.conversational_whole_grade,
          condition: c.conversational_condition_label,
          thumb,
          gradedAt: c.created_at,
        }
      })
    )

    return NextResponse.json({ results })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Search failed' }, { status: 500 })
  }
}
