import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/admin/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    const { is_featured } = await request.json()
    const cardId = params.id

    // Update the card's featured status
    const { error } = await supabaseAdmin
      .from('cards')
      .update({ is_featured })
      .eq('id', cardId)

    if (error) {
      console.error('Error updating featured status:', error)
      throw error
    }

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
