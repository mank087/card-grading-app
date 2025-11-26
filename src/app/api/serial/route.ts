import { NextResponse } from 'next/server';
import { generateNextSerial } from '@/lib/serialGenerator';

/**
 * GET /api/serial
 * Generates the next available DCM serial number.
 *
 * Returns:
 * - serial: 10-digit zero-padded numeric string (e.g., "0000000042")
 */
export async function GET() {
  try {
    const serial = await generateNextSerial();

    return NextResponse.json({
      serial,
      format: '10-digit numeric',
      example: '0000000001'
    });
  } catch (error: any) {
    console.error('[Serial API] Error generating serial:', error);
    return NextResponse.json(
      { error: 'Failed to generate serial number', details: error.message },
      { status: 500 }
    );
  }
}
