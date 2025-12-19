/**
 * Simple in-memory rate limiter for authentication endpoints
 * Protects against brute force attacks
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// Store rate limit data in memory
// Key format: "action:identifier" (e.g., "login:192.168.1.1" or "register:user@email.com")
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Cleanup every minute

export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetTime: number;
  retryAfterMs?: number;
}

// Default configurations for different actions
export const RATE_LIMIT_CONFIGS = {
  login: { maxRequests: 5, windowMs: 15 * 60 * 1000 }, // 5 attempts per 15 minutes
  register: { maxRequests: 3, windowMs: 60 * 60 * 1000 }, // 3 registrations per hour
  passwordReset: { maxRequests: 3, windowMs: 60 * 60 * 1000 }, // 3 resets per hour
  api: { maxRequests: 100, windowMs: 60 * 1000 }, // 100 requests per minute
} as const;

/**
 * Check if a request should be rate limited
 * @param action - The action being performed (e.g., "login", "register")
 * @param identifier - Unique identifier (e.g., IP address, email)
 * @param config - Rate limit configuration
 * @returns Rate limit result
 */
export function checkRateLimit(
  action: string,
  identifier: string,
  config: RateLimitConfig = RATE_LIMIT_CONFIGS.api
): RateLimitResult {
  const key = `${action}:${identifier}`;
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  // If no entry exists or window has expired, create new entry
  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    return {
      success: true,
      remaining: config.maxRequests - 1,
      resetTime: now + config.windowMs,
    };
  }

  // Check if limit exceeded
  if (entry.count >= config.maxRequests) {
    return {
      success: false,
      remaining: 0,
      resetTime: entry.resetTime,
      retryAfterMs: entry.resetTime - now,
    };
  }

  // Increment counter
  entry.count++;
  return {
    success: true,
    remaining: config.maxRequests - entry.count,
    resetTime: entry.resetTime,
  };
}

/**
 * Reset rate limit for a specific action and identifier
 * Useful after successful authentication
 */
export function resetRateLimit(action: string, identifier: string): void {
  const key = `${action}:${identifier}`;
  rateLimitStore.delete(key);
}

/**
 * Get identifier from request headers (for server actions)
 * Falls back to a default if no identifier can be determined
 */
export function getClientIdentifier(headers: Headers): string {
  // Try various headers that might contain the real IP
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  const realIp = headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  // Fallback - in development this is fine, in production you should configure your proxy
  return "unknown-client";
}
