import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  try {
    const supabase = supabaseServer();
    const formData = await req.formData();
    const frontImage = formData.get("frontImage") as File | null;
    const backImage = formData.get("backImage") as File | null;

    if (!frontImage || !backImage) {
      return NextResponse.json(
        { error: "Both front and back images are required." },
        { status: 400 }
      );
    }

    const filePrefix = uuidv4();
    const frontPath = `${filePrefix}-front.jpeg`;
    const backPath = `${filePrefix}-back.jpeg`;

    // 1. Upload images to Supabase Storage
    const { error: frontError } = await supabase.storage
      .from("cards")
      .upload(frontPath, frontImage);
    const { error: backError } = await supabase.storage
      .from("cards")
      .upload(backPath, backImage);

    if (frontError || backError) {
      console.error("Supabase Storage Upload Error:", frontError, backError);
      return NextResponse.json(
        { error: "Failed to upload images." },
        { status: 500 }
      );
    }

    // 2. Insert new card record into Supabase Database
    const { data, error: insertError } = await supabase
      .from("cards")
      .insert({ front_path: frontPath, back_path: backPath })
      .select()
      .single();

    if (insertError) {
      console.error("Supabase DB Insert Error:", insertError);
      return NextResponse.json(
        { error: "Failed to save card data." },
        { status: 500 }
      );
    }

    const cardId = data.id;

    // 3. **Crucial Step:** Trigger the AI grading API route
    // Use an explicit URL to ensure the request is made correctly.
    // For development, use `http://localhost:3000`. In production, this would be your domain.
    const gradingApiUrl = `http://localhost:3000/api/card/${cardId}`;
    
    console.log(`Triggering AI grading for card ID: ${cardId}`);
    fetch(gradingApiUrl).catch(err => {
      console.error(`Failed to trigger AI grading for card ${cardId}:`, err);
    });

    // 4. Return a successful response with the new card's ID
    return NextResponse.json(
      { success: true, id: cardId },
      { status: 201 }
    );
  } catch (e) {
    console.error("General Upload API Error:", e);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}