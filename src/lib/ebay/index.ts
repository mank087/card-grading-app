/**
 * eBay Integration Module
 *
 * Central export point for all eBay integration functionality.
 */

// Types
export * from './types';

// Constants
export * from './constants';

// Client
export {
  createEbayClient,
  createAuthenticatedClient,
  validateEbayConfig,
  isEbayConfigured,
  getEbayEnvironment,
  getAuthorizationUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  needsTokenRefresh,
  getEbayUserInfo,
  getListingUrl,
} from './client';

// Auth
export {
  encryptToken,
  decryptToken,
  createAuthState,
  verifyAuthState,
  getEbayConnection,
  saveEbayConnection,
  updateEbayTokens,
  deleteEbayConnection,
  updateConnectionLastUsed,
  getValidAccessToken,
  hasActiveEbayConnection,
} from './auth';
