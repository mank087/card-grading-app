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

    // Optimized identification prompt - strict OCR, no AI corrections
    const identificationPrompt = `
READ this Pokemon TCG card and extract EXACTLY what is printed:

1. CARD NAME (top of card)
   - Read the FULL name exactly as printed
   - Include X or Y for Mega evolutions (e.g., "Mega Charizard X" not "Mega Charizard")
   - Include EX/GX/V suffixes

2. CARD NUMBER (bottom of card)
   🚨 CRITICAL: Read the number EXACTLY as printed on the card
   - Do NOT change or correct the number based on your knowledge
   - If card shows "125/094", report "125/094" (NOT 125/106 or 125/109)
   - Japanese cards have different set totals than English - report what you SEE
   - Format: "XXX/YYY" where XXX is card number, YYY is set total

3. SET NAME (if visible near card number)

4. RARITY (symbol: ●=common, ◆=uncommon, ★=rare)

Output format:
**Card Name**: [EXACT name as printed]
**Card Number**: [EXACT as printed, e.g., "125/094"]
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

    // Parse AI response
    const nameMatch = aiResponse.match(/\*\*Card Name\*\*:\s*(.+?)(?=\n|$)/);
    const cardNumberMatch = aiResponse.match(/\*\*Card Number\*\*:\s*(.+?)(?=\n|$)/);
    const setMatch = aiResponse.match(/\*\*Set Name\*\*:\s*(.+?)(?=\n|$)/);
    const rarityMatch = aiResponse.match(/\*\*Rarity\*\*:\s*(.+?)(?=\n|$)/);

    // Parse card number: "125/094" → cardNumber="125", fullNumberText="125/094"
    const rawCardNumber = cardNumberMatch ? cardNumberMatch[1].trim() : null;
    let cardNumber = null;
    let fullNumberText = rawCardNumber;

    if (rawCardNumber && rawCardNumber.includes('/')) {
      // Extract numerator from "125/094" → "125"
      cardNumber = rawCardNumber.split('/')[0].trim();
    } else if (rawCardNumber) {
      cardNumber = rawCardNumber;
    }

    const identification = {
      name: nameMatch ? nameMatch[1].trim() : null,
      set: setMatch ? setMatch[1].trim() : null,
      fullNumberText: fullNumberText,
      cardNumber: cardNumber,
      rarity: rarityMatch ? rarityMatch[1].trim() : null
    };

    // Clean up "Not visible" values
    if (identification.fullNumberText?.toLowerCase().includes('not visible')) {
      identification.fullNumberText = null;
    }
    if (identification.cardNumber?.toLowerCase().includes('not visible')) {
      identification.cardNumber = null;
    }
    if (identification.set?.toLowerCase().includes('not visible')) {
      identification.set = null;
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
