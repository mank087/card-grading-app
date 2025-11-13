// src/app/api/pokemon/identify/route.ts
// Lightweight AI call to identify card name and set only

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function POST(request: NextRequest) {
  try {
    const { frontImageUrl, backImageUrl } = await request.json();

    if (!frontImageUrl) {
      return NextResponse.json(
        { error: 'Front image URL required' },
        { status: 400 }
      );
    }

    // Optimized identification prompt - concise but precise
    const identificationPrompt = `
Extract these fields from this Pokemon TCG card:

1. CARD NAME (top of card)
2. CARD NUMBER (bottom right corner)
   - Modern format: "SVP EN 085" → Extract "SVP EN 085" AND "085"
   - Vintage format: "4/102" → Extract "4/102" AND "4"
   - Keep leading zeros! "085" ≠ "85"
3. SET NAME (if visible)
4. RARITY (symbol: circle=common, diamond=uncommon, star=rare)

Output format:
**Card Name**: [name]
**Full Number Text**: [everything shown, e.g. "SVP EN 085"]
**Card Number Only**: [just digits, e.g. "085"]
**Set Name**: [set or "Not visible"]
**Rarity**: [rarity or "Not visible"]
`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-2024-08-06',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: identificationPrompt
            },
            {
              type: 'image_url',
              image_url: { url: frontImageUrl }
            }
          ]
        }
      ],
      max_tokens: 500 // More detailed response with card number extraction
    });

    const aiResponse = response.choices[0].message.content || '';

    // Parse AI response with new fields
    const nameMatch = aiResponse.match(/\*\*Card Name\*\*:\s*(.+?)(?=\n|$)/);
    const setMatch = aiResponse.match(/\*\*Set Name\*\*:\s*(.+?)(?=\n|$)/);
    const fullNumberMatch = aiResponse.match(/\*\*Full Number Text\*\*:\s*(.+?)(?=\n|$)/);
    const cardNumberMatch = aiResponse.match(/\*\*Card Number Only\*\*:\s*(.+?)(?=\n|$)/);
    const rarityMatch = aiResponse.match(/\*\*Rarity\*\*:\s*(.+?)(?=\n|$)/);

    const identification = {
      name: nameMatch ? nameMatch[1].trim() : null,
      set: setMatch ? setMatch[1].trim() : null,
      fullNumberText: fullNumberMatch ? fullNumberMatch[1].trim() : null,
      cardNumber: cardNumberMatch ? cardNumberMatch[1].trim() : null,
      rarity: rarityMatch ? rarityMatch[1].trim() : null
    };

    // Clean up "Not visible" values
    if (identification.fullNumberText?.toLowerCase().includes('not visible')) {
      identification.fullNumberText = null;
    }
    if (identification.cardNumber?.toLowerCase().includes('not visible')) {
      identification.cardNumber = null;
    }
    if (identification.rarity?.toLowerCase().includes('not visible')) {
      identification.rarity = null;
    }

    console.log('[Pokemon Identify] AI identified:', identification);

    return NextResponse.json({
      success: true,
      identification,
      aiResponse // Include full response for debugging
    });

  } catch (error: any) {
    console.error('Pokemon identification error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
