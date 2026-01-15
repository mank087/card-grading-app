import { NextResponse } from 'next/server';
import {
  isEbayConfigured,
  getAuthorizationUrl,
  createAuthState,
  EBAY_OAUTH_SCOPES,
  getEbayEnvironment,
} from '@/lib/ebay';

/**
 * GET /api/ebay/debug
 *
 * Debug endpoint to check eBay configuration and generated OAuth URL.
 * REMOVE THIS IN PRODUCTION - only for debugging.
 */
export async function GET() {
  const config = {
    appId: process.env.EBAY_APP_ID ? `${process.env.EBAY_APP_ID.slice(0, 20)}...` : 'NOT SET',
    certId: process.env.EBAY_CERT_ID ? 'SET (hidden)' : 'NOT SET',
    devId: process.env.EBAY_DEV_ID ? `${process.env.EBAY_DEV_ID.slice(0, 20)}...` : 'NOT SET',
    ruName: process.env.EBAY_RUNAME || 'NOT SET',
    redirectUri: process.env.EBAY_REDIRECT_URI || 'NOT SET',
    sandbox: process.env.EBAY_SANDBOX,
    encryptionKey: process.env.EBAY_ENCRYPTION_KEY ? 'SET (hidden)' : 'NOT SET',
  };

  const isConfigured = isEbayConfigured();
  const environment = getEbayEnvironment();

  // Generate a test auth URL
  const testState = createAuthState('test-user-id', '/account');
  const authUrl = getAuthorizationUrl(testState, [...EBAY_OAUTH_SCOPES]);

  // Parse the generated URL to show parameters
  const url = new URL(authUrl);
  const params: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    if (key === 'state') {
      params[key] = value.slice(0, 30) + '...';
    } else {
      params[key] = value;
    }
  });

  return NextResponse.json({
    configured: isConfigured,
    environment,
    config,
    generatedUrl: {
      base: url.origin + url.pathname,
      params,
    },
    fullUrl: authUrl.slice(0, 150) + '...',
  });
}
