import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET() {
  try {
    const supabase = supabaseServer();

    // Try to count cards in database
    const { count, error } = await supabase
      .from("cards")
      .select("*", { count: "exact", head: true });

    if (error) {
      return NextResponse.json({
        status: "error",
        message: "Database connection failed",
        error: error.message,
        env_check: {
          has_supabase_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
          has_service_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY
        }
      }, { status: 500 });
    }

    return NextResponse.json({
      status: "ok",
      message: "API routes are working",
      database: "connected",
      card_count: count,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    return NextResponse.json({
      status: "error",
      message: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
