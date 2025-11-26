/**
 * Diagnostic script to check card data structure across different card types
 * Run with: npx tsx scripts/check-card-data-structure.ts <card_id> <card_type>
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCardData(cardId: string, cardType: string) {
  console.log(`\n🔍 Checking ${cardType} card ID: ${cardId}\n`);

  // Fetch the card
  const { data: card, error } = await supabase
    .from(`${cardType}_cards`)
    .select('*')
    .eq('id', cardId)
    .single();

  if (error) {
    console.error('❌ Error fetching card:', error);
    return;
  }

  if (!card) {
    console.error('❌ Card not found');
    return;
  }

  console.log('✅ Card found!\n');

  // Check conversational_corners_edges_surface structure
  console.log('📊 conversational_corners_edges_surface structure:');
  const ces = card.conversational_corners_edges_surface;

  if (!ces) {
    console.log('❌ conversational_corners_edges_surface is null/undefined');
  } else {
    console.log('✓ conversational_corners_edges_surface exists');

    // Check for surface data
    console.log('\n🎨 SURFACE DATA:');
    console.log('  Front Surface:');
    console.log('    - ces.surface?.front:', !!ces.surface?.front);
    console.log('    - ces.front_surface:', !!ces.front_surface);
    if (ces.surface?.front) {
      console.log('      - analysis:', !!ces.surface.front.analysis);
      console.log('      - defects:', Array.isArray(ces.surface.front.defects) ? `Array(${ces.surface.front.defects.length})` : 'none');
      console.log('      - summary:', !!ces.surface.front.summary);
      console.log('      - score:', ces.surface.front.score);
    } else if (ces.front_surface) {
      console.log('      - analysis:', !!ces.front_surface.analysis);
      console.log('      - defects:', Array.isArray(ces.front_surface.defects) ? `Array(${ces.front_surface.defects.length})` : 'none');
      console.log('      - summary:', !!ces.front_surface.summary);
      console.log('      - score:', ces.front_surface.score);
    }

    console.log('  Back Surface:');
    console.log('    - ces.surface?.back:', !!ces.surface?.back);
    console.log('    - ces.back_surface:', !!ces.back_surface);
    if (ces.surface?.back) {
      console.log('      - analysis:', !!ces.surface.back.analysis);
      console.log('      - defects:', Array.isArray(ces.surface.back.defects) ? `Array(${ces.surface.back.defects.length})` : 'none');
      console.log('      - summary:', !!ces.surface.back.summary);
      console.log('      - score:', ces.surface.back.score);
    } else if (ces.back_surface) {
      console.log('      - analysis:', !!ces.back_surface.analysis);
      console.log('      - defects:', Array.isArray(ces.back_surface.defects) ? `Array(${ces.back_surface.defects.length})` : 'none');
      console.log('      - summary:', !!ces.back_surface.summary);
      console.log('      - score:', ces.back_surface.score);
    }

    // Check for corners data
    console.log('\n📐 CORNERS DATA:');
    console.log('  Front Corners:');
    console.log('    - ces.corners?.front:', !!ces.corners?.front);
    console.log('    - ces.front_corners:', !!ces.front_corners);
    const frontCorners = ces.corners?.front || ces.front_corners;
    if (frontCorners) {
      console.log('      - summary:', !!frontCorners.summary);
      console.log('      - score:', frontCorners.score);
    }

    console.log('  Back Corners:');
    console.log('    - ces.corners?.back:', !!ces.corners?.back);
    console.log('    - ces.back_corners:', !!ces.back_corners);
    const backCorners = ces.corners?.back || ces.back_corners;
    if (backCorners) {
      console.log('      - summary:', !!backCorners.summary);
      console.log('      - score:', backCorners.score);
    }

    // Check for edges data
    console.log('\n📏 EDGES DATA:');
    console.log('  Front Edges:');
    console.log('    - ces.edges?.front:', !!ces.edges?.front);
    console.log('    - ces.front_edges:', !!ces.front_edges);
    const frontEdges = ces.edges?.front || ces.front_edges;
    if (frontEdges) {
      console.log('      - summary:', !!frontEdges.summary);
      console.log('      - score:', frontEdges.score);
    }

    console.log('  Back Edges:');
    console.log('    - ces.edges?.back:', !!ces.edges?.back);
    console.log('    - ces.back_edges:', !!ces.back_edges);
    const backEdges = ces.edges?.back || ces.back_edges;
    if (backEdges) {
      console.log('      - summary:', !!backEdges.summary);
      console.log('      - score:', backEdges.score);
    }
  }

  // Check centering data
  console.log('\n📍 CENTERING DATA:');
  console.log('  conversational_centering_ratios:');
  const ccr = card.conversational_centering_ratios;
  if (ccr) {
    console.log('    - front_lr:', ccr.front_lr);
    console.log('    - front_tb:', ccr.front_tb);
    console.log('    - front_quality_tier:', ccr.front_quality_tier);
    console.log('    - back_lr:', ccr.back_lr);
    console.log('    - back_tb:', ccr.back_tb);
    console.log('    - back_quality_tier:', ccr.back_quality_tier);
  } else {
    console.log('    ❌ conversational_centering_ratios is null/undefined');
  }

  console.log('\n  conversational_corners_edges_surface.front_centering:');
  const frontCentering = ces?.front_centering;
  if (frontCentering) {
    console.log('    - summary:', !!frontCentering.summary);
    console.log('    - summary length:', frontCentering.summary?.length || 0);
  } else {
    console.log('    ❌ front_centering is null/undefined');
  }

  console.log('\n  conversational_corners_edges_surface.back_centering:');
  const backCentering = ces?.back_centering;
  if (backCentering) {
    console.log('    - summary:', !!backCentering.summary);
    console.log('    - summary length:', backCentering.summary?.length || 0);
  } else {
    console.log('    ❌ back_centering is null/undefined');
  }

  // Check if this is a v5 card
  console.log('\n🏷️  VERSION CHECK:');
  const hasQualityTiers = !!card.conversational_centering_ratios?.front_quality_tier;
  const hasNestedStructure = !!ces?.corners?.front || !!ces?.edges?.front || !!ces?.surface?.front;
  const hasFlatStructure = !!ces?.front_corners || !!ces?.front_edges || !!ces?.front_surface;

  console.log('  Has quality_tier fields (v5.0):', hasQualityTiers);
  console.log('  Has nested structure (ces.surface.front):', hasNestedStructure);
  console.log('  Has flat structure (ces.front_surface):', hasFlatStructure);

  if (!hasQualityTiers) {
    console.log('\n⚠️  This card was graded with an older schema.');
    console.log('    Re-grade the card to get v5.0 data with quality tiers.');
  }

  // Print sample data for debugging
  console.log('\n📝 SAMPLE DATA (for debugging):');
  if (ces?.surface?.front || ces?.front_surface) {
    const surface = ces?.surface?.front || ces?.front_surface;
    console.log('  Front Surface Summary:', surface.summary || '(none)');
    console.log('  Front Surface Analysis:', surface.analysis || '(none)');
    console.log('  Front Surface Score:', surface.score || '(none)');
  }
}

// Parse command line arguments
const cardId = process.argv[2];
const cardType = process.argv[3];

if (!cardId || !cardType) {
  console.error('Usage: npx tsx scripts/check-card-data-structure.ts <card_id> <card_type>');
  console.error('Example: npx tsx scripts/check-card-data-structure.ts 123 pokemon');
  console.error('Valid card types: pokemon, sports, lorcana, mtg, other');
  process.exit(1);
}

checkCardData(cardId, cardType).then(() => {
  console.log('\n✅ Check complete!\n');
  process.exit(0);
});
