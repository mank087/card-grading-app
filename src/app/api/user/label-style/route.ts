/**
 * Label Style Preference API
 * GET: Retrieve user's current label style preference + custom styles
 * POST: Switch style, save/delete/rename custom styles
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/serverAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const VALID_BUILT_IN = ['modern', 'traditional'];
const VALID_CUSTOM_IDS = ['custom-1', 'custom-2', 'custom-3', 'custom-4'];
const MAX_CUSTOM_STYLES = 4;

function isValidStyleId(id: string): boolean {
  return VALID_BUILT_IN.includes(id) || VALID_CUSTOM_IDS.includes(id);
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const userId = authResult.user.id;

    const { data, error } = await supabaseAdmin
      .from('user_credits')
      .select('label_style, custom_label_styles')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching label style:', error);
      return NextResponse.json({ error: 'Failed to fetch preference' }, { status: 500 });
    }

    const labelStyle = data?.label_style || 'modern';
    const customStyles = data?.custom_label_styles || [];

    return NextResponse.json({
      success: true,
      labelStyle,
      customStyles,
    });
  } catch (error) {
    console.error('Get label style error:', error);
    return NextResponse.json({ error: 'Failed to fetch preference' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const userId = authResult.user.id;
    const body = await request.json();
    const { action } = body;

    // Fetch current state
    const { data: currentData } = await supabaseAdmin
      .from('user_credits')
      .select('label_style, custom_label_styles')
      .eq('user_id', userId)
      .single();

    const currentCustomStyles: any[] = currentData?.custom_label_styles || [];
    const currentLabelStyle = currentData?.label_style || 'modern';

    // === SWITCH STYLE (no action field, just labelStyle) ===
    if (!action && body.labelStyle) {
      const { labelStyle } = body;

      if (!isValidStyleId(labelStyle)) {
        return NextResponse.json(
          { error: 'Invalid label style' },
          { status: 400 }
        );
      }

      // If switching to a custom style, verify it exists
      if (VALID_CUSTOM_IDS.includes(labelStyle)) {
        const exists = currentCustomStyles.some((s: any) => s.id === labelStyle);
        if (!exists) {
          return NextResponse.json(
            { error: 'Custom style not found' },
            { status: 400 }
          );
        }
      }

      const { error } = await supabaseAdmin
        .from('user_credits')
        .update({ label_style: labelStyle })
        .eq('user_id', userId);

      if (error) {
        console.error('Error updating label style:', error);
        return NextResponse.json({ error: 'Failed to update preference' }, { status: 500 });
      }

      return NextResponse.json({ success: true, labelStyle });
    }

    // === SAVE CUSTOM STYLE ===
    if (action === 'save') {
      const { style } = body;
      if (!style || !style.config) {
        return NextResponse.json({ error: 'Style config required' }, { status: 400 });
      }

      let updatedStyles = [...currentCustomStyles];
      let savedStyle: any;

      if (style.id && VALID_CUSTOM_IDS.includes(style.id)) {
        // Update existing
        const idx = updatedStyles.findIndex((s: any) => s.id === style.id);
        if (idx >= 0) {
          updatedStyles[idx] = {
            ...updatedStyles[idx],
            name: style.name || updatedStyles[idx].name,
            config: style.config,
          };
          savedStyle = updatedStyles[idx];
        } else {
          // ID specified but doesn't exist yet - create with that ID
          if (updatedStyles.length >= MAX_CUSTOM_STYLES) {
            return NextResponse.json({ error: 'Maximum 4 custom styles. Delete one first.' }, { status: 400 });
          }
          savedStyle = { id: style.id, name: style.name || `Custom Label ${style.id.split('-')[1]}`, config: style.config };
          updatedStyles.push(savedStyle);
        }
      } else {
        // Assign next available slot
        if (updatedStyles.length >= MAX_CUSTOM_STYLES) {
          return NextResponse.json({ error: 'Maximum 4 custom styles. Delete one first.' }, { status: 400 });
        }

        const usedIds = new Set(updatedStyles.map((s: any) => s.id));
        const nextId = VALID_CUSTOM_IDS.find(id => !usedIds.has(id));
        if (!nextId) {
          return NextResponse.json({ error: 'No available custom style slots' }, { status: 400 });
        }

        const slotNumber = nextId.split('-')[1];
        savedStyle = {
          id: nextId,
          name: style.name || `Custom Label ${slotNumber}`,
          config: style.config,
        };
        updatedStyles.push(savedStyle);
      }

      const { error } = await supabaseAdmin
        .from('user_credits')
        .update({ custom_label_styles: updatedStyles })
        .eq('user_id', userId);

      if (error) {
        console.error('Error saving custom style:', error);
        return NextResponse.json({ error: 'Failed to save custom style' }, { status: 500 });
      }

      return NextResponse.json({ success: true, customStyles: updatedStyles, savedStyle });
    }

    // === DELETE CUSTOM STYLE ===
    if (action === 'delete') {
      const { styleId } = body;
      if (!styleId || !VALID_CUSTOM_IDS.includes(styleId)) {
        return NextResponse.json({ error: 'Invalid style ID' }, { status: 400 });
      }

      const updatedStyles = currentCustomStyles.filter((s: any) => s.id !== styleId);

      // If deleted style was active, revert to modern
      const updateData: any = { custom_label_styles: updatedStyles };
      let newLabelStyle = currentLabelStyle;
      if (currentLabelStyle === styleId) {
        updateData.label_style = 'modern';
        newLabelStyle = 'modern';
      }

      const { error } = await supabaseAdmin
        .from('user_credits')
        .update(updateData)
        .eq('user_id', userId);

      if (error) {
        console.error('Error deleting custom style:', error);
        return NextResponse.json({ error: 'Failed to delete custom style' }, { status: 500 });
      }

      return NextResponse.json({ success: true, customStyles: updatedStyles, labelStyle: newLabelStyle });
    }

    // === RENAME CUSTOM STYLE ===
    if (action === 'rename') {
      const { styleId, name } = body;
      if (!styleId || !name) {
        return NextResponse.json({ error: 'Style ID and name required' }, { status: 400 });
      }

      const updatedStyles = currentCustomStyles.map((s: any) =>
        s.id === styleId ? { ...s, name } : s
      );

      const { error } = await supabaseAdmin
        .from('user_credits')
        .update({ custom_label_styles: updatedStyles })
        .eq('user_id', userId);

      if (error) {
        console.error('Error renaming custom style:', error);
        return NextResponse.json({ error: 'Failed to rename custom style' }, { status: 500 });
      }

      return NextResponse.json({ success: true, customStyles: updatedStyles });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error) {
    console.error('Update label style error:', error);
    return NextResponse.json({ error: 'Failed to update preference' }, { status: 500 });
  }
}
