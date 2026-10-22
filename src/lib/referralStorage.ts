/**
 * Browser-side storage for the referral code from a ?ref= link (localStorage,
 * 30-day window). Shared by ReferralTracker, sign-up and the auth callback.
 * The code is validated server-side wherever it is used.
 */
export const REF_CODE_KEY = 'dcm_ref_code';
export const REF_TIMESTAMP_KEY = 'dcm_ref_timestamp';
export const REF_ATTRIBUTION_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
/** Query param carrying the code on the sign-up confirmation link (not `ref`, so it is not counted as a click). */
export const SIGNUP_REF_PARAM = 'aref';

export function getStoredRefCode(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const code = localStorage.getItem(REF_CODE_KEY);
    const timestamp = localStorage.getItem(REF_TIMESTAMP_KEY);
    if (!code || !timestamp) return null;
    if (Date.now() - parseInt(timestamp, 10) > REF_ATTRIBUTION_WINDOW_MS) {
      localStorage.removeItem(REF_CODE_KEY);
      localStorage.removeItem(REF_TIMESTAMP_KEY);
      return null;
    }
    return code;
  } catch {
    return null;
  }
}

export function storeRefCode(raw: string, at: number = Date.now()): string | null {
  if (typeof window === 'undefined') return null;
  const code = String(raw || '').trim().toUpperCase();
  if (!/^[A-Z0-9_-]{2,32}$/.test(code)) return null;
  try {
    localStorage.setItem(REF_CODE_KEY, code);
    localStorage.setItem(REF_TIMESTAMP_KEY, String(at));
    return code;
  } catch {
    return null;
  }
}
