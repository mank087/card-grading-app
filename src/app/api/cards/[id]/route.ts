import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { verifyAuth } from '@/lib/serverAuth'

// Delete card
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Verify authentication - get user ID from token, not query params
    const auth = await verifyAuth(request)
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
    }
    const userId = auth.userId

    const supabase = supabaseServer()

    // Get card to verify ownership
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .select('id, user_id, front_path, back_path')
      .eq('id', id)
      .single()

    if (cardError || !card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 })
    }

    // Verify user owns the card
    if (card.user_id !== userId) {
      return NextResponse.json({ error: 'Unauthorized - You can only delete your own cards' }, { status: 403 })
    }

    // Delete card images from storage
    try {
      if (card.front_path) {
        await supabase.storage.from('cards').remove([card.front_path])
      }
      if (card.back_path) {
        await supabase.storage.from('cards').remove([card.back_path])
      }
    } catch (storageError) {
      console.warn('Failed to delete card images from storage:', storageError)
      // Continue with card deletion even if storage deletion fails
    }

    // Delete card from database
    const { error: deleteError } = await supabase
      .from('cards')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Error deleting card from database:', deleteError)
      return NextResponse.json({ error: 'Failed to delete card' }, { status: 500 })
    }

    return NextResponse.json({
      message: 'Card deleted successfully'
    }, { status: 200 })
  } catch (error) {
    console.error('Error deleting card:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
