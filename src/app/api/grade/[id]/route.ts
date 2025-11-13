import { NextResponse } from "next/server";
import OpenAI from "openai";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * Helper: Create a temporary signed URL for a storage object.
 */
async function signUrl(
  supabase: ReturnType<typeof supabaseServer>,
  bucket: string,
  path: string,
  seconds = 60 * 10 // 10 minutes
) {
  if (!path) {
    return null;
  }
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, seconds);
  
  if (error) {
    console.error(`Signed URL error for path ${path}:`, error);
    // Explicitly return null on error
    return null;
  }
  return data?.signedUrl ?? null;
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const cardId = params.id;
  const supabase = supabaseServer();

  try {
    // 1) Fetch card row to get paths
    const { data: card, error: fetchErr } = await supabase
      .from("cards")
      .select("front_path, back_path") // Explicitly select only necessary columns
      .eq("id", cardId)
      .single();

    if (fetchErr || !card) {
      console.error(`AI route: card fetch error for ID ${cardId}:`, fetchErr);
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    const { front_path, back_path } = card;

    // 2) Signed URLs for the model
    const frontUrl = front_path
      ? await signUrl(supabase, "cards", front_path)
      : null;
    const backUrl = back_path
      ? await signUrl(supabase, "cards", back_path)
      : null;

    if (!frontUrl && !backUrl) {
      return NextResponse.json(
        { error: "No images available for this card" },
        { status: 400 }
      );
    }

    // 3) Build the system/user messages
    const systemMsg = `
You are an expert trading card grader. 
You MUST return a strictly valid JSON object (no markdown code fences, no commentary).
If unsure, leave fields as empty strings "" or "-" as applicable.
`;

    const structuredInstruction = `
I am providing images of a trading card. Please review the scan(s) and return JSON using the schema below.
Only include information confirmed from the images or official sources. If not certain, leave blank ("") or "-"
except the Estimated Value section (best-effort). Do not include any URLs or citations.

Output JSON schema (keys must exist):

{
  "final_score": {
    "overall_grade_display": "string" // e.g. "9/B"
  },
  "card_information": {
    "card_name": "string",
    "category": "string",      // Sports, Pokémon, Magic: The Gathering, Yu-Gi-Oh!, One Piece, Other
    "card_number": "string",   // "-" if none
    "serial_numbering": "string", // "-" if none
    "card_set": "string",
    "manufacturer_name": "string",
    "release_date": "string",
    "authentic": "Yes or No"
  },
  "card_details": {
    "featured": "string",      // players/characters
    "rookie_or_first_print": "Yes or No",
    "rarity_description": "string"   // 1–2 sentence factual description
  },
  "grading": {
    "raw_decimal_grade": "string",   // 1.0–10.0 in 0.1 increments
    "img_grade_whole": "string",     // 1–10 (use mapping below)
    "explanation": {
      "corners": "string (5–10 words)",
      "edges": "string (5–10 words)",
      "surface_front": "string (5–10 words)",
      "surface_back": "string (5–10 words)",
      "centering_front": "string (5–10 words)",
      "centering_back": "string (5–10 words)",
      "print_quality": "string (5–10 words)",
      "color_gloss": "string (5–10 words)",
      "structural_integrity": "string (5–10 words)",
      "defacing_or_alterations": "string (5–10 words)",
      "special_features": "string (5–10 words)"
    },
    "summary": "string (2–3 sentences)"
  },
  "img_score_system": {
    "condition_grade_base": "string",      // 1–10
    "ai_confidence_score": "A|B|C|D",
    "final_img_score": "string"          // e.g. "9/B"
  },
  "img_estimated_value": {
    "estimated_market_value": "string",   // "$XX.XX"
    "estimated_range": "string",          // "$XX.XX – $XX.XX"
    "estimate_confidence": "High|Medium|Low",
    "note": "string"
  },
  "obstruction_handling": {
    "obstruction_summary": "string"     // mention if glare/case etc. and its impact; empty string if none
  }
}

Range mapping (decimal to whole):
10 = 9.5–10.0
9  = 8.8–9.4
8  = 8.0–8.7
7  = 7.0–7.9
6  = 6.0–6.9
5  = 5.0–5.9
4  = 4.0–4.9
3  = 3.0–3.9
2  = 2.0–2.9
1  = 1.0–1.9

AI Confidence & Image Quality:
A = Clear scan, minimal glare
B = Minor glare/sleeve, details visible
C = Significant glare/case/cropping
D = Major obstruction; unreliable

Return ONLY JSON matching the schema above.`;

    // 4) Call OpenAI
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const contentParts: any[] = [{ type: "text", text: structuredInstruction }];
    if (frontUrl) contentParts.push({ type: "image_url", image_url: { url: frontUrl } });
    if (backUrl) contentParts.push({ type: "image_url", image_url: { url: backUrl } });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemMsg },
        { role: "user", content: contentParts as any },
      ],
      temperature: 0.2,
      max_tokens: 1500,
    });

    const raw = completion.choices?.[0]?.message?.content || "{}";

    // 5) Parse JSON
    let parsed: any = {};
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      console.error("AI JSON parse error:", err);
      // Fallback to an empty object to avoid crashes
      parsed = {};
    }

    const suggestion = {
      grade: parsed?.img_score_system?.condition_grade_base ?? null, // Use null for empty values
      quality: parsed?.img_score_system?.ai_confidence_score ?? null,
      notes:
        parsed?.grading?.summary ||
        parsed?.obstruction_handling?.obstruction_summary ||
        "",
    };

    return NextResponse.json({
      suggestion, // used by UI
      parsed,      // full structured AI grading
      raw,         // raw JSON string
      frontUrl,
      backUrl,
    });
  } catch (err) {
    console.error("AI grading route error:", err);
    return NextResponse.json({ error: "AI grading failed" }, { status: 500 });
  }
}