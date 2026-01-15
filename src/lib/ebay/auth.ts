/**
 * eBay Authentication Utilities
 *
 * Handles token encryption/decryption, database operations for connections,
 * and token refresh logic.
 */

import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  refreshAccessToken,
  needsTokenRefresh,
  getEbayUserInfo,
} from './client';
import { TOKEN_CONFIG, EBAY_OAUTH_SCOPES } from './constants';
import type { EbayConnection, EbayTokens, EbayAuthState } from './types';

// =============================================================================
// Token Encryption
// =============================================================================

const ENCRYPTION_KEY = process.env.EBAY_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY || '';
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

/**
 * Encrypt sensitive data (tokens) before storing in database
 */
export function encryptToken(plaintext: string): string {
  if (!ENCRYPTION_KEY) {
    console.warn('[eBay] No encryption key configured, storing token in plaintext');
    return plaintext;
  }

  try {
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('[eBay] Encryption failed:', error);
    throw new Error('Failed to encrypt token');
  }
}

/**
 * Decrypt sensitive data retrieved from database
 */
export function decryptToken(ciphertext: string): string {
  if (!ENCRYPTION_KEY) {
    // If no encryption key, assume data is plaintext
    return ciphertext;
  }

  // Check if data looks encrypted (has two colons for iv:authTag:encrypted format)
  if (!ciphertext.includes(':')) {
    return ciphertext; // Return as-is if not encrypted
  }

  try {
    const [ivHex, authTagHex, encrypted] = ciphertext.split(':');

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);

    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('[eBay] Decryption failed:', error);
    throw new Error('Failed to decrypt token');
  }
}

// =============================================================================
// Auth State Management
// =============================================================================

/**
 * Create a signed state parameter for OAuth flow
 * This prevents CSRF attacks by validating the state on callback
 */
export function createAuthState(userId: string, returnUrl?: string): string {
  const state: EbayAuthState = {
    user_id: userId,
    return_url: returnUrl,
    timestamp: Date.now(),
  };

  const stateJson = JSON.stringify(state);
  const encoded = Buffer.from(stateJson).toString('base64url');

  // Sign the state to prevent tampering
  const signature = crypto
    .createHmac('sha256', ENCRYPTION_KEY || 'default-key')
    .update(encoded)
    .digest('hex')
    .slice(0, 16);

  return `${encoded}.${signature}`;
}

/**
 * Verify and parse the state parameter from OAuth callback
 */
export function verifyAuthState(state: string): EbayAuthState | null {
  try {
    const [encoded, signature] = state.split('.');

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', ENCRYPTION_KEY || 'default-key')
      .update(encoded)
      .digest('hex')
      .slice(0, 16);

    if (signature !== expectedSignature) {
      console.error('[eBay] Invalid state signature');
      return null;
    }

    // Decode and parse
    const stateJson = Buffer.from(encoded, 'base64url').toString('utf8');
    const state_data: EbayAuthState = JSON.parse(stateJson);

    // Check if state is not too old (max 15 minutes)
    const maxAge = 15 * 60 * 1000;
    if (Date.now() - state_data.timestamp > maxAge) {
      console.error('[eBay] State expired');
      return null;
    }

    return state_data;
  } catch (error) {
    console.error('[eBay] Failed to verify state:', error);
    return null;
  }
}

// =============================================================================
// Database Operations
// =============================================================================

/**
 * Get eBay connection for a user
 */
export async function getEbayConnection(userId: string): Promise<EbayConnection | null> {
  const { data, error } = await supabaseAdmin
    .from('ebay_connections')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return null;
  }

  // Decrypt tokens
  return {
    ...data,
    access_token: decryptToken(data.access_token),
    refresh_token: decryptToken(data.refresh_token),
  };
}

/**
 * Save a new eBay connection after OAuth
 */
export async function saveEbayConnection(
  userId: string,
  tokens: EbayTokens,
  sandbox: boolean = false
): Promise<EbayConnection> {
  // Get user info from eBay
  const userInfo = await getEbayUserInfo(tokens.access_token);

  // Calculate expiration times
  const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);
  const refreshTokenExpiresAt = tokens.refresh_token_expires_in
    ? new Date(Date.now() + tokens.refresh_token_expires_in * 1000)
    : new Date(Date.now() + TOKEN_CONFIG.REFRESH_TOKEN_EXPIRY_MONTHS * 30 * 24 * 60 * 60 * 1000);

  // Encrypt tokens before storing
  const encryptedAccessToken = encryptToken(tokens.access_token);
  const encryptedRefreshToken = encryptToken(tokens.refresh_token);

  const connectionData = {
    user_id: userId,
    ebay_user_id: userInfo.userId,
    ebay_username: userInfo.username,
    access_token: encryptedAccessToken,
    refresh_token: encryptedRefreshToken,
    token_expires_at: tokenExpiresAt.toISOString(),
    refresh_token_expires_at: refreshTokenExpiresAt.toISOString(),
    scopes: [...EBAY_OAUTH_SCOPES],
    marketplace_id: 'EBAY_US',
    is_sandbox: sandbox,
    last_token_refresh_at: new Date().toISOString(),
  };

  // Upsert to handle reconnection
  const { data, error } = await supabaseAdmin
    .from('ebay_connections')
    .upsert(connectionData, {
      onConflict: 'user_id',
    })
    .select()
    .single();

  if (error) {
    console.error('[eBay] Failed to save connection:', error);
    throw new Error('Failed to save eBay connection');
  }

  // Return with decrypted tokens
  return {
    ...data,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
  };
}

/**
 * Update tokens after refresh
 */
export async function updateEbayTokens(
  userId: string,
  tokens: EbayTokens
): Promise<void> {
  const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  const { error } = await supabaseAdmin
    .from('ebay_connections')
    .update({
      access_token: encryptToken(tokens.access_token),
      refresh_token: encryptToken(tokens.refresh_token),
      token_expires_at: tokenExpiresAt.toISOString(),
      last_token_refresh_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) {
    console.error('[eBay] Failed to update tokens:', error);
    throw new Error('Failed to update eBay tokens');
  }
}

/**
 * Delete eBay connection (disconnect)
 */
export async function deleteEbayConnection(userId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('ebay_connections')
    .delete()
    .eq('user_id', userId);

  if (error) {
    console.error('[eBay] Failed to delete connection:', error);
    throw new Error('Failed to disconnect eBay account');
  }
}

/**
 * Update last used timestamp
 */
export async function updateConnectionLastUsed(userId: string): Promise<void> {
  await supabaseAdmin
    .from('ebay_connections')
    .update({ last_used_at: new Date().toISOString() })
    .eq('user_id', userId);
}

// =============================================================================
// Token Management
// =============================================================================

/**
 * Get a valid access token, refreshing if necessary
 * This should be called before any eBay API request
 */
export async function getValidAccessToken(userId: string): Promise<string> {
  const connection = await getEbayConnection(userId);

  if (!connection) {
    throw new Error('No eBay connection found');
  }

  // Check if token needs refresh
  if (needsTokenRefresh(connection)) {
    console.log('[eBay] Refreshing access token for user:', userId);

    try {
      const newTokens = await refreshAccessToken(connection.refresh_token);
      await updateEbayTokens(userId, newTokens);
      return newTokens.access_token;
    } catch (error) {
      console.error('[eBay] Token refresh failed:', error);
      // Delete the connection if refresh fails (token may be revoked)
      await deleteEbayConnection(userId);
      throw new Error('eBay session expired. Please reconnect your account.');
    }
  }

  return connection.access_token;
}

/**
 * Check if a user has an active eBay connection
 */
export async function hasActiveEbayConnection(userId: string): Promise<boolean> {
  const connection = await getEbayConnection(userId);
  if (!connection) return false;

  // Check if refresh token has expired
  if (connection.refresh_token_expires_at) {
    const refreshExpires = new Date(connection.refresh_token_expires_at);
    if (refreshExpires < new Date()) {
      // Refresh token expired, delete connection
      await deleteEbayConnection(userId);
      return false;
    }
  }

  return true;
}
