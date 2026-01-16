/**
 * eBay Image Upload API
 *
 * Uploads card images (front, back, mini-report) to Supabase Storage
 * for use in eBay listings. Returns public URLs that can be used
 * in the eBay Inventory API.
 *
 * POST /api/ebay/images
 * Body: { cardId, images: { front?: base64, back?: base64, miniReport?: base64 } }
 * Returns: { urls: { front?: string, back?: string, miniReport?: string } }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getConnectionForUser } from '@/lib/ebay/auth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Create admin client for storage operations
function getAdminClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

// Storage bucket name for eBay listing images
const EBAY_IMAGES_BUCKET = 'ebay-listing-images';

interface ImageUploadRequest {
  cardId: string;
  images: {
    front?: string;  // base64 data URL or raw base64
    back?: string;
    miniReport?: string;
  };
}

interface ImageUploadResponse {
  urls: {
    front?: string;
    back?: string;
    miniReport?: string;
  };
}

/**
 * Convert base64 data URL or raw base64 to buffer
 */
function base64ToBuffer(base64: string): Buffer {
  // Handle data URL format: data:image/jpeg;base64,/9j/4AAQ...
  const base64Data = base64.includes('base64,')
    ? base64.split('base64,')[1]
    : base64;

  return Buffer.from(base64Data, 'base64');
}

/**
 * Get content type from base64 data URL or default to JPEG
 */
function getContentType(base64: string): string {
  if (base64.startsWith('data:')) {
    const match = base64.match(/data:([^;]+);/);
    if (match) return match[1];
  }
  return 'image/jpeg';
}

export async function POST(request: NextRequest) {
  try {
    // Get user from authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in first.' },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);

    // Verify user token with Supabase
    const supabase = getAdminClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error('[eBay Images] User verification failed:', userError);
      return NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 401 }
      );
    }

    // Check if user has eBay connection
    const connection = await getConnectionForUser(user.id);
    if (!connection) {
      return NextResponse.json(
        { error: 'No eBay account connected. Please connect your eBay account first.' },
        { status: 400 }
      );
    }

    // Parse request body
    const body: ImageUploadRequest = await request.json();
    const { cardId, images } = body;

    if (!cardId) {
      return NextResponse.json(
        { error: 'Card ID is required' },
        { status: 400 }
      );
    }

    if (!images || (!images.front && !images.back && !images.miniReport)) {
      return NextResponse.json(
        { error: 'At least one image is required' },
        { status: 400 }
      );
    }

    // Ensure the bucket exists (create if not)
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(b => b.name === EBAY_IMAGES_BUCKET);

    if (!bucketExists) {
      const { error: createError } = await supabase.storage.createBucket(EBAY_IMAGES_BUCKET, {
        public: true,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        fileSizeLimit: 12 * 1024 * 1024, // 12MB (eBay limit)
      });

      if (createError && !createError.message.includes('already exists')) {
        console.error('[eBay Images] Failed to create bucket:', createError);
        return NextResponse.json(
          { error: 'Failed to initialize image storage' },
          { status: 500 }
        );
      }
    }

    // Generate unique folder path for this card's listing images
    const timestamp = Date.now();
    const basePath = `${user.id}/${cardId}/${timestamp}`;

    const urls: ImageUploadResponse['urls'] = {};

    // Upload each image
    const uploadImage = async (
      imageData: string,
      imageName: string
    ): Promise<string | null> => {
      try {
        const buffer = base64ToBuffer(imageData);
        const contentType = getContentType(imageData);
        const extension = contentType.split('/')[1] || 'jpg';
        const filePath = `${basePath}/${imageName}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from(EBAY_IMAGES_BUCKET)
          .upload(filePath, buffer, {
            contentType,
            upsert: true,
          });

        if (uploadError) {
          console.error(`[eBay Images] Failed to upload ${imageName}:`, uploadError);
          return null;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from(EBAY_IMAGES_BUCKET)
          .getPublicUrl(filePath);

        return urlData.publicUrl;
      } catch (err) {
        console.error(`[eBay Images] Error uploading ${imageName}:`, err);
        return null;
      }
    };

    // Upload images in parallel
    const uploadPromises: Promise<void>[] = [];

    if (images.front) {
      uploadPromises.push(
        uploadImage(images.front, 'front').then(url => {
          if (url) urls.front = url;
        })
      );
    }

    if (images.back) {
      uploadPromises.push(
        uploadImage(images.back, 'back').then(url => {
          if (url) urls.back = url;
        })
      );
    }

    if (images.miniReport) {
      uploadPromises.push(
        uploadImage(images.miniReport, 'mini-report').then(url => {
          if (url) urls.miniReport = url;
        })
      );
    }

    await Promise.all(uploadPromises);

    // Verify at least one upload succeeded
    if (!urls.front && !urls.back && !urls.miniReport) {
      return NextResponse.json(
        { error: 'Failed to upload any images' },
        { status: 500 }
      );
    }

    console.log('[eBay Images] Upload successful:', {
      userId: user.id,
      cardId,
      uploadedImages: Object.keys(urls),
    });

    return NextResponse.json({ urls });
  } catch (error) {
    console.error('[eBay Images] Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
