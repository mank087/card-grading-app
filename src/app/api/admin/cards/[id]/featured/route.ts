import { NextRequest, NextResponse } from 'next/server'
import { clientIp, logAdminActivity, verifyAdminSession } from '@/lib/admin/adminAuth'
import { isUuid } from '@/lib/uuid'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify admin session
    const token = request.cookies.get('admin_token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = await verifyAdminSession(token)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: cardId } = await params
    if (!isUuid(cardId)) {
      return NextResponse.json({ error: 'Invalid card id' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const raw = body?.is_featured
    // Coerce to a real boolean: the column takes whatever JSON arrives otherwise.
    const is_featured = raw === true || raw === 'true' ? true
      : raw === false || raw === 'false' ? false
      : null
    if (is_featured === null) {
      return NextResponse.json({ error: 'is_featured must be a boolean' }, { status: 400 })
    }

    // Update the card's featured status
    const { error } = await supabaseAdmin
      .from('cards')
      .update({ is_featured })
      .eq('id', cardId)

    if (error) {
      console.error('Error updating featured status:', error)
      throw error
    }

    await logAdminActivity(admin.id, admin.email, is_featured ? 'feature_card' : 'unfeature_card', 'card', cardId, {
      is_featured,
    }, clientIp(request))

    return NextResponse.json(
      { message: 'Featured status updated successfully', is_featured },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error in toggle featured API:', error)
    return NextResponse.json(
      { error: 'Failed to update featured status' },
      { status: 500 }
    )
  }
}
