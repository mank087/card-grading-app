/**
 * Rate limiting utility for API endpoints
 * Uses in-memory sliding window algorithm
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

// In-memory store for rate limits (per-instance)
// In production with multiple instances, use Redis instead
const rateLimitStore = new Map<string, RateLimitEntry>()

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key)
    }
  }
}, 60000) // Clean up every minute

export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  maxRequests: number
  /** Window duration in seconds */
  windowSeconds: number
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean
  /** Current request count in window */
  current: number
  /** Maximum allowed requests */
  limit: number
  /** Seconds until rate limit resets */
  retryAfter: number
  /** Remaining requests in window */
  remaining: number
}

/**
 * Check rate limit for a given identifier
 * @param identifier - Unique identifier (e.g., user ID, IP address)
 * @param config - Rate limit configuration
 * @returns Rate limit result
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now()
  const windowMs = config.windowSeconds * 1000
  const key = identifier

  let entry = rateLimitStore.get(key)

  // If no entry or window expired, create new entry
  if (!entry || entry.resetAt < now) {
    entry = {
      count: 1,
      resetAt: now + windowMs
    }
    rateLimitStore.set(key, entry)

    return {
      allowed: true,
      current: 1,
      limit: config.maxRequests,
      retryAfter: 0,
      remaining: config.maxRequests - 1
    }
  }

  // Increment count
  entry.count++
  rateLimitStore.set(key, entry)

  const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
  const remaining = Math.max(0, config.maxRequests - entry.count)

  if (entry.count > config.maxRequests) {
    return {
      allowed: false,
      current: entry.count,
      limit: config.maxRequests,
      retryAfter,
      remaining: 0
    }
  }

  return {
    allowed: true,
    current: entry.count,
    limit: config.maxRequests,
    retryAfter: 0,
    remaining
  }
}

/**
 * Pre-configured rate limits for different endpoint types
 */
export const RATE_LIMITS = {
  /** Card grading - 10 requests per minute */
  GRADING: {
    maxRequests: 10,
    windowSeconds: 60
  },
  /** Image upload - 20 requests per minute */
  UPLOAD: {
    maxRequests: 20,
    windowSeconds: 60
  },
  /** Credit purchase - 5 requests per minute */
  PAYMENT: {
    maxRequests: 5,
    windowSeconds: 60
  },
  /** Authentication - 10 requests per 5 minutes */
  AUTH: {
    maxRequests: 10,
    windowSeconds: 300
  },
  /** General API - 100 requests per minute */
  GENERAL: {
    maxRequests: 100,
    windowSeconds: 60
  },
  /** Credit deduction - 15 requests per minute */
  CREDIT_DEDUCT: {
    maxRequests: 15,
    windowSeconds: 60
  }
} as const

/**
 * Get identifier from request (user ID or IP)
 */
export function getRateLimitIdentifier(
  userId: string | null,
  request: Request
): string {
  if (userId) {
    return `user:${userId}`
  }

  // Fall back to IP address for unauthenticated requests
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown'
  return `ip:${ip}`
}

/**
 * Create rate limit error response
 */
export function createRateLimitResponse(result: RateLimitResult) {
  return {
    error: 'Too many requests. Please wait before trying again.',
    retryAfter: result.retryAfter,
    limit: result.limit,
    current: result.current
  }
}
