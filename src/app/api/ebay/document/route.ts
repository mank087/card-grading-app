/**
 * eBay Document Upload API
 *
 * Uploads regulatory documents (like grading reports) to eBay's Media API
 * for inclusion in listings as Certificate of Analysis.
 *
 * POST /api/ebay/document
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getConnectionForUser, refreshTokenIfNeeded } from '@/lib/ebay/auth';
import { uploadGradingReport } from '@/lib/ebay/mediaApi';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getAdminClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in first.' },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);
    const supabase = getAdminClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 401 }
      );
    }

    // Get eBay connection and refresh token if needed
    let connection = await getConnectionForUser(user.id);
    if (!connection) {
      return NextResponse.json(
        { error: 'No eBay account connected' },
        { status: 400 }
      );
    }

    // Refresh token if needed
    connection = await refreshTokenIfNeeded(connection);
    if (!connection) {
      return NextResponse.json(
        { error: 'Failed to refresh eBay authorization. Please reconnect your account.' },
        { status: 401 }
      );
    }

    // Get the uploaded file from form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const fileName = formData.get('fileName') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Convert File to Blob
    const arrayBuffer = await file.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: file.type || 'application/pdf' });

    console.log('[eBay Document] Uploading grading report:', {
      fileName: fileName || file.name,
      fileSize: file.size,
      fileType: file.type,
      sandbox: connection.is_sandbox,
    });

    // Upload the document to eBay Media API
    const result = await uploadGradingReport(
      connection.access_token,
      blob,
      fileName || file.name || 'DCM-Grading-Report.pdf',
      connection.is_sandbox
    );

    if (!result.success) {
      console.error('[eBay Document] Upload failed:', result.error);
      return NextResponse.json(
        { error: result.error || 'Failed to upload document' },
        { status: 400 }
      );
    }

    console.log('[eBay Document] Document uploaded successfully:', result.documentId);

    return NextResponse.json({
      success: true,
      documentId: result.documentId,
      documentStatus: result.documentStatus,
    });
  } catch (error) {
    console.error('[eBay Document] Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred', details: String(error) },
      { status: 500 }
    );
  }
}
