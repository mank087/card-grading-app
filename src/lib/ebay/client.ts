/**
 * eBay API Client
 *
 * Wrapper around the ebay-api library for interacting with eBay REST APIs.
 * Handles client initialization, token management, and common operations.
 */

import eBayApi from 'ebay-api';
import { EBAY_API_URLS, TOKEN_CONFIG } from './constants';
import type { EbayConnection, EbayTokens } from './types';

// =============================================================================
// Environment Configuration
// =============================================================================

const EBAY_CONFIG = {
  appId: process.env.EBAY_APP_ID || '',
  certId: process.env.EBAY_CERT_ID || '',
  devId: process.env.EBAY_DEV_ID || '',
  redirectUri: process.env.EBAY_REDIRECT_URI || '',
  sandbox: process.env.EBAY_SANDBOX === 'true',
};

/**
 * Validate that required eBay environment variables are set
 */
export function validateEbayConfig(): { valid: boolean; missing: string[] } {
  const required = ['EBAY_APP_ID', 'EBAY_CERT_ID', 'EBAY_DEV_ID', 'EBAY_REDIRECT_URI'];
  const missing = required.filter(key => !process.env[key]);
  return { valid: missing.length === 0, missing };
}

// =============================================================================
// Client Factory
// =============================================================================

/**
 * Create a new eBay API client instance
 * This creates an unauthenticated client - use setUserTokens to authenticate
 */
export function createEbayClient(): eBayApi {
  const client = new eBayApi({
    appId: EBAY_CONFIG.appId,
    certId: EBAY_CONFIG.certId,
    devId: EBAY_CONFIG.devId,
    sandbox: EBAY_CONFIG.sandbox,
    siteId: eBayApi.SiteId.EBAY_US,
  });

  return client;
}

/**
 * Create an eBay client authenticated with user tokens
 */
export function createAuthenticatedClient(connection: EbayConnection): eBayApi {
  const client = createEbayClient();

  // Calculate expires_in from token_expires_at
  const expiresAt = new Date(connection.token_expires_at).getTime();
  const now = Date.now();
  const expiresIn = Math.max(0, Math.floor((expiresAt - now) / 1000));

  client.OAuth2.setCredentials({
    access_token: connection.access_token,
    refresh_token: connection.refresh_token,
    expires_in: expiresIn,
  });

  return client;
}

// =============================================================================
// OAuth Helpers
// =============================================================================

/**
 * Get the eBay authorization URL for OAuth flow
 */
export function getAuthorizationUrl(state: string, scopes: string[]): string {
  const baseUrl = EBAY_CONFIG.sandbox
    ? EBAY_API_URLS.sandbox.auth
    : EBAY_API_URLS.production.auth;

  const params = new URLSearchParams({
    client_id: EBAY_CONFIG.appId,
    redirect_uri: EBAY_CONFIG.redirectUri,
    response_type: 'code',
    scope: scopes.join(' '),
    state: state,
  });

  return `${baseUrl}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<EbayTokens> {
  const tokenUrl = EBAY_CONFIG.sandbox
    ? EBAY_API_URLS.sandbox.token
    : EBAY_API_URLS.production.token;

  const credentials = Buffer.from(
    `${EBAY_CONFIG.appId}:${EBAY_CONFIG.certId}`
  ).toString('base64');

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: EBAY_CONFIG.redirectUri,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[eBay] Token exchange failed:', error);
    throw new Error(`Failed to exchange code for tokens: ${response.status}`);
  }

  return response.json();
}

/**
 * Refresh an expired access token
 */
export async function refreshAccessToken(refreshToken: string): Promise<EbayTokens> {
  const tokenUrl = EBAY_CONFIG.sandbox
    ? EBAY_API_URLS.sandbox.token
    : EBAY_API_URLS.production.token;

  const credentials = Buffer.from(
    `${EBAY_CONFIG.appId}:${EBAY_CONFIG.certId}`
  ).toString('base64');

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: 'https://api.ebay.com/oauth/api_scope/sell.inventory https://api.ebay.com/oauth/api_scope/sell.account https://api.ebay.com/oauth/api_scope/commerce.media.upload',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[eBay] Token refresh failed:', error);
    throw new Error(`Failed to refresh token: ${response.status}`);
  }

  return response.json();
}

/**
 * Check if access token needs refresh (expires within threshold)
 */
export function needsTokenRefresh(connection: EbayConnection): boolean {
  const expiresAt = new Date(connection.token_expires_at).getTime();
  const refreshThreshold = TOKEN_CONFIG.REFRESH_THRESHOLD_MINUTES * 60 * 1000;
  return Date.now() + refreshThreshold >= expiresAt;
}

/**
 * Get eBay user info from token
 * Uses the Identity API to get the authenticated user's details
 */
export async function getEbayUserInfo(accessToken: string): Promise<{
  userId: string;
  username: string;
}> {
  const apiUrl = EBAY_CONFIG.sandbox
    ? 'https://api.sandbox.ebay.com'
    : 'https://api.ebay.com';

  // Use the Commerce Identity API
  const response = await fetch(`${apiUrl}/commerce/identity/v1/user/`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    console.error('[eBay] Failed to get user info:', response.status);
    // Return a placeholder if we can't get user info
    return {
      userId: 'unknown',
      username: 'eBay User',
    };
  }

  const data = await response.json();
  return {
    userId: data.userId || 'unknown',
    username: data.username || 'eBay User',
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Check if eBay integration is properly configured
 */
export function isEbayConfigured(): boolean {
  return !!(
    EBAY_CONFIG.appId &&
    EBAY_CONFIG.certId &&
    EBAY_CONFIG.devId &&
    EBAY_CONFIG.redirectUri
  );
}

/**
 * Get current environment (sandbox or production)
 */
export function getEbayEnvironment(): 'sandbox' | 'production' {
  return EBAY_CONFIG.sandbox ? 'sandbox' : 'production';
}

/**
 * Format eBay listing URL
 */
export function getListingUrl(listingId: string, sandbox: boolean = EBAY_CONFIG.sandbox): string {
  const baseUrl = sandbox
    ? 'https://sandbox.ebay.com/itm'
    : 'https://www.ebay.com/itm';
  return `${baseUrl}/${listingId}`;
}
