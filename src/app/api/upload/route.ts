import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { supabaseServer } from "@/lib/supabaseServer";
import { verifyAuth } from "@/lib/serverAuth";

export async function POST(req: NextRequest) {
  try {
    // Verify user is authenticated
    const authResult = await verifyAuth(req);
    if (!authResult.authenticated || !authResult.userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const supabase = supabaseServer();
    const formData = await req.formData();
    const frontImage = formData.get("frontImage") as File | null;
    const backImage = formData.get("backImage") as File | null;

    // Validate file types
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (frontImage && !allowedTypes.includes(frontImage.type)) {
      return NextResponse.json(
        { error: "Invalid front image type. Only JPEG, PNG, and WebP are allowed." },
        { status: 400 }
      );
    }
    if (backImage && !allowedTypes.includes(backImage.type)) {
      return NextResponse.json(
        { error: "Invalid back image type. Only JPEG, PNG, and WebP are allowed." },
        { status: 400 }
      );
    }

    // Validate file sizes (max 10MB each)
    const maxSize = 10 * 1024 * 1024;
    if (frontImage && frontImage.size > maxSize) {
      return NextResponse.json(
        { error: "Front image too large. Maximum size is 10MB." },
        { status: 400 }
      );
    }
    if (backImage && backImage.size > maxSize) {
      return NextResponse.json(
        { error: "Back image too large. Maximum size is 10MB." },
        { status: 400 }
      );
    }

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
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'https://dcmgrading.com';
    const gradingApiUrl = `${baseUrl}/api/card/${cardId}`;
    
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