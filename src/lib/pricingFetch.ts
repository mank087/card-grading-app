/**
 * Shared pricing API fetch utility
 *
 * Provides robust fetching for PriceCharting/SportsCardsPro APIs with:
 * - Cloudflare bot detection handling (HTML challenge pages)
 * - Content-Type validation before JSON parsing
 * - Retry with exponential backoff on 429/500/502/503
 * - Custom error class carrying upstream status codes
 * - Inter-request delay helper for rate limiting
 */

/**
 * Custom error class for pricing API errors.
 * Carries the upstream HTTP status so API routes can propagate it.
 */
export class PricingApiError extends Error {
  /** The HTTP status code from the upstream pricing API */
  public readonly upstreamStatus: number;
  /** Whether this error is retryable (transient) */
  public readonly retryable: boolean;
  /** Whether this was a Cloudflare challenge/block */
  public readonly cloudflareBlocked: boolean;

  constructor(
    message: string,
    upstreamStatus: number,
    options?: { retryable?: boolean; cloudflareBlocked?: boolean }
  ) {
    super(message);
    this.name = 'PricingApiError';
    this.upstreamStatus = upstreamStatus;
    this.retryable = options?.retryable ?? false;
    this.cloudflareBlocked = options?.cloudflareBlocked ?? false;
  }
}

/** Status codes that should trigger a retry */
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503]);

/** Minimum delay between sequential pricing API calls (ms) */
const MIN_INTER_REQUEST_DELAY_MS = 300;

/**
 * Detect if a response body is a Cloudflare challenge page
 */
function isCloudflareChallenge(body: string, contentType: string | null): boolean {
  if (contentType?.includes('text/html')) {
    return (
      body.includes('cloudflare') ||
      body.includes('cf_chl_opt') ||
      body.includes('challenge-platform') ||
      body.includes('Just a moment') ||
      body.includes('Enable JavaScript and cookies')
    );
  }
  return false;
}

/**
 * Check if response Content-Type indicates JSON
 */
function isJsonContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  return contentType.includes('application/json');
}

export interface SafeFetchOptions {
  /** Maximum number of retries (default: 2) */
  retries?: number;
  /** Request timeout in ms (default: 15000) */
  timeoutMs?: number;
  /** Log prefix for console messages (e.g., "[SportsCardsPro]") */
  logPrefix?: string;
  /** Whether to throw on non-OK responses (default: true for search, false for price lookups) */
  throwOnError?: boolean;
}

export interface SafeFetchResult<T> {
  data: T | null;
  error: PricingApiError | null;
}

/**
 * Safely fetch JSON from a pricing API with retry, Cloudflare detection, and proper error handling.
 *
 * @param url - The full URL to fetch
 * @param options - Fetch configuration
 * @returns The parsed JSON data, or throws PricingApiError
 */
export async function safePricingFetch<T = unknown>(
  url: string,
  options: SafeFetchOptions = {}
): Promise<SafeFetchResult<T>> {
  const {
    retries = 2,
    timeoutMs = 15000,
    logPrefix = '[PricingAPI]',
    throwOnError = true,
  } = options;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const contentType = response.headers.get('content-type');

      // Handle non-OK responses
      if (!response.ok) {
        const bodyText = await response.text();
        const status = response.status;

        // Check for Cloudflare challenge
        if (isCloudflareChallenge(bodyText, contentType)) {
          const err = new PricingApiError(
            `Cloudflare challenge on pricing API (HTTP ${status})`,
            status,
            { retryable: status === 429, cloudflareBlocked: true }
          );

          // Only retry on 429 (rate limit), not on 403 (blocked)
          if (status === 429 && attempt < retries) {
            const delay = Math.min(2000 * Math.pow(2, attempt), 10000);
            console.warn(`${logPrefix} Cloudflare rate limit (429), retrying in ${delay}ms (attempt ${attempt + 2}/${retries + 1})...`);
            await new Promise(r => setTimeout(r, delay));
            continue;
          }

          console.error(`${logPrefix} Cloudflare blocked request (HTTP ${status})`);
          if (throwOnError) throw err;
          return { data: null, error: err };
        }

        // Check for transient/retryable errors
        const isDeadline = bodyText.includes('DeadlineExceeded') || bodyText.includes('timeout');
        const isRetryable = RETRYABLE_STATUS_CODES.has(status) || isDeadline;

        if (isRetryable && attempt < retries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
          console.warn(`${logPrefix} HTTP ${status}, retrying in ${delay}ms (attempt ${attempt + 2}/${retries + 1})...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }

        // Non-retryable or exhausted retries
        const err = new PricingApiError(
          `Pricing API error: HTTP ${status}`,
          status,
          { retryable: isRetryable }
        );
        console.error(`${logPrefix} Request failed: HTTP ${status}`);
        if (throwOnError) throw err;
        return { data: null, error: err };
      }

      // Response is OK - validate Content-Type before parsing JSON
      if (contentType && !isJsonContentType(contentType)) {
        // Got a 200 but with HTML body (rare Cloudflare scenario)
        const bodyText = await response.text();
        if (isCloudflareChallenge(bodyText, contentType)) {
          const err = new PricingApiError(
            'Cloudflare challenge returned with 200 status',
            200,
            { retryable: true, cloudflareBlocked: true }
          );

          if (attempt < retries) {
            const delay = Math.min(2000 * Math.pow(2, attempt), 10000);
            console.warn(`${logPrefix} Cloudflare challenge (200 + HTML), retrying in ${delay}ms...`);
            await new Promise(r => setTimeout(r, delay));
            continue;
          }

          console.error(`${logPrefix} Cloudflare challenge returned as 200`);
          if (throwOnError) throw err;
          return { data: null, error: err };
        }

        // Non-Cloudflare HTML response
        const err = new PricingApiError(
          `Unexpected Content-Type: ${contentType}`,
          200,
          { retryable: false }
        );
        console.error(`${logPrefix} Expected JSON but got ${contentType}`);
        if (throwOnError) throw err;
        return { data: null, error: err };
      }

      // Parse JSON safely
      try {
        const data = await response.json() as T;
        return { data, error: null };
      } catch (parseError) {
        const err = new PricingApiError(
          'Failed to parse JSON response',
          200,
          { retryable: false }
        );
        console.error(`${logPrefix} JSON parse error:`, parseError);
        if (throwOnError) throw err;
        return { data: null, error: err };
      }

    } catch (error) {
      // Handle AbortError (timeout)
      if (error instanceof Error && error.name === 'AbortError') {
        if (attempt < retries) {
          const delay = 1000 * (attempt + 1);
          console.warn(`${logPrefix} Request timeout, retrying in ${delay}ms (attempt ${attempt + 2}/${retries + 1})...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        const err = new PricingApiError('Request timed out', 408, { retryable: true });
        console.error(`${logPrefix} Request timed out after all retries`);
        if (throwOnError) throw err;
        return { data: null, error: err };
      }

      // Re-throw PricingApiError as-is
      if (error instanceof PricingApiError) {
        if (throwOnError) throw error;
        return { data: null, error };
      }

      // Unknown error
      throw error;
    }
  }

  // Should not reach here, but satisfy TypeScript
  return { data: null, error: new PricingApiError('Exhausted all retries', 500, { retryable: false }) };
}

/**
 * Sleep for the minimum inter-request delay.
 * Call this between sequential pricing API calls to avoid triggering rate limits.
 */
export async function pricingDelay(ms?: number): Promise<void> {
  await new Promise(r => setTimeout(r, ms ?? MIN_INTER_REQUEST_DELAY_MS));
}

/**
 * Map a PricingApiError to the appropriate HTTP status for API route responses.
 * Returns 429 for rate limits, 503 for upstream failures, 500 for unknown errors.
 */
export function mapPricingErrorToHttpStatus(error: unknown): number {
  if (error instanceof PricingApiError) {
    if (error.cloudflareBlocked || error.upstreamStatus === 429) return 429;
    if (error.upstreamStatus === 403) return 503; // upstream blocked us
    if ([500, 502, 503].includes(error.upstreamStatus)) return 503;
    if (error.upstreamStatus === 408) return 504; // timeout -> gateway timeout
  }
  return 500;
}
