import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/admin/adminAuth'
import { supabase } from '@/lib/supabaseClient'

// Update flag status (resolve/dismiss)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Verify admin session
    const token = request.cookies.get('admin_token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = await verifyAdminSession(token)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, notes } = body

    if (action === 'resolve') {
      // Mark flag as resolved
      const { error: updateError } = await supabase
        .from('card_flags')
        .update({
          status: 'resolved',
          resolved_by: admin.id,
          resolved_at: new Date().toISOString(),
          resolution_notes: notes || null
        })
        .eq('id', id)

      if (updateError) {
        throw updateError
      }

      // Log the action
      await supabase
        .from('admin_activity_log')
        .insert({
          admin_id: admin.id,
          action: 'resolve_flag',
          resource_type: 'card_flag',
          resource_id: id,
          details: { notes },
          ip_address: request.headers.get('x-forwarded-for') || 'unknown'
        })

      return NextResponse.json({
        message: 'Flag resolved successfully'
      }, { status: 200 })
    } else if (action === 'dismiss') {
      // Mark flag as dismissed
      const { error: updateError } = await supabase
        .from('card_flags')
        .update({
          status: 'dismissed',
          resolved_by: admin.id,
          resolved_at: new Date().toISOString(),
          resolution_notes: notes || null
        })
        .eq('id', id)

      if (updateError) {
        throw updateError
      }

      // Log the action
      await supabase
        .from('admin_activity_log')
        .insert({
          admin_id: admin.id,
          action: 'dismiss_flag',
          resource_type: 'card_flag',
          resource_id: id,
          details: { notes },
          ip_address: request.headers.get('x-forwarded-for') || 'unknown'
        })

      return NextResponse.json({
        message: 'Flag dismissed successfully'
      }, { status: 200 })
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Error updating flag:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
