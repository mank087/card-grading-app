import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/admin/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { generateLabelData, type CardForLabel } from '@/lib/labelDataGenerator'

export async function POST(
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

    // Fetch the card with all required fields for label generation
    const { data: card, error: fetchError } = await supabaseAdmin
      .from('cards')
      .select(`
        id,
        category,
        serial,
        conversational_decimal_grade,
        conversational_whole_grade,
        conversational_condition_label,
        conversational_card_info,
        dvg_decimal_grade,
        card_name,
        card_set,
        card_number,
        featured,
        pokemon_featured,
        release_date,
        serial_numbering,
        rarity_tier,
        rarity_description,
        autographed,
        autograph_type,
        memorabilia_type,
        rookie_card,
        first_print_rookie,
        holofoil,
        is_foil,
        foil_type,
        is_double_faced,
        mtg_rarity
      `)
      .eq('id', cardId)
      .single()

    if (fetchError) {
      console.error('Error fetching card:', fetchError)
      return NextResponse.json({ error: 'Card not found' }, { status: 404 })
    }

    // Generate new label data
    const labelData = generateLabelData(card as CardForLabel)

    // Update the card with new label_data
    const { error: updateError } = await supabaseAdmin
      .from('cards')
      .update({ label_data: labelData })
      .eq('id', cardId)

    if (updateError) {
      console.error('Error updating label data:', updateError)
      return NextResponse.json({ error: 'Failed to update label' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Label regenerated successfully',
      labelData
    }, { status: 200 })

  } catch (error) {
    console.error('Error regenerating label:', error)
    return NextResponse.json(
      { error: 'Failed to regenerate label' },
      { status: 500 }
    )
  }
}
