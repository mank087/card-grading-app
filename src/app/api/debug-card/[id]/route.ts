import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

type DebugRequest = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, { params }: DebugRequest) {
  const { id: cardId } = await params;
  const supabase = supabaseServer();

  // Get card from database - no category filter
  const { data: card, error } = await supabase
    .from("cards")
    .select("id, serial, category, card_name, featured, front_path, back_path, created_at")
    .eq("id", cardId)
    .single();

  if (error || !card) {
    return NextResponse.json({
      error: "Card not found",
      details: error?.message
    }, { status: 404 });
  }

  return NextResponse.json({
    card,
    category_info: {
      value: card.category,
      type: typeof card.category,
      length: card.category?.length,
      trimmed: card.category?.trim(),
      equals_Other: card.category === "Other",
      equals_other: card.category === "other",
    }
  });
}
