// src/app/api/pokemon/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { smartSearchPokemonCards } from '@/lib/pokemonTcgApi';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const name = searchParams.get('name');
  const set = searchParams.get('set');
  const cardNumber = searchParams.get('number');
  const fullNumberText = searchParams.get('fullNumberText');

  if (!name) {
    return NextResponse.json(
      { error: 'Name parameter required' },
      { status: 400 }
    );
  }

  try {
    // Use smart search with multi-tier fallback and flexible number formats
    const { results, strategy } = await smartSearchPokemonCards(
      name,
      set || undefined,
      cardNumber || undefined,
      fullNumberText || undefined
    );

    console.log(`[Pokemon Search API] Found ${results.length} cards using ${strategy} strategy`);

    return NextResponse.json({
      success: true,
      count: results.length,
      data: results,
      strategy: strategy // Include which strategy was used
    });
  } catch (error: any) {
    console.error('Pokemon search error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
