// lib/ratelimit.ts
// Production-grade rate limiting using Upstash Redis (free tier: 10k req/day)
// Falls back to in-memory map when Redis isn't configured (development)
// Documentation: https://github.com/upstash/ratelimit

import { NextRequest } from 'next/server';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RateLimitResult {
  success: boolean;         // true = allowed through
  limit: number;            // max requests allowed
  remaining: number;        // requests remaining in window
  reset: number;            // Unix timestamp when window resets
  retryAfter?: number;      // seconds until retry (only when blocked)
}

export interface RateLimitConfig {
  requests: number;         // max requests
  window: string;           // e.g. "10 s", "1 m", "1 h", "1 d"
  prefix?: string;          // Redis key prefix for namespacing
}

// ─── Named rate limit tiers ───────────────────────────────────────────────────
// Tune these values to your traffic patterns

export const RATE_LIMITS = {
  // Public search — generous but protects against scraping
  SEARCH:          { requests: 30,  window: '1 m',  prefix: 'rl:search'  },
  SEARCH_SEMANTIC: { requests: 20,  window: '1 m',  prefix: 'rl:semantic'},

  // Auth endpoints — strict to block brute force
  LOGIN:           { requests: 5,   window: '15 m', prefix: 'rl:login'   },
  REGISTER:        { requests: 3,   window: '1 h',  prefix: 'rl:register'},
  PASSWORD_RESET:  { requests: 3,   window: '1 h',  prefix: 'rl:pwreset' },

  // Content actions — per user
  REVIEW_SUBMIT:   { requests: 5,   window: '1 h',  prefix: 'rl:review'  },
  WATCHLIST:       { requests: 60,  window: '1 m',  prefix: 'rl:wl'      },

  // Payment endpoints — very strict
  CHECKOUT:        { requests: 5,   window: '1 h',  prefix: 'rl:checkout'},

  // TMDb proxy — cache-friendly
  PROVIDERS:       { requests: 60,  window: '1 m',  prefix: 'rl:prov'    },

  // Global catch-all per IP
  GLOBAL:          { requests: 200, window: '1 m',  prefix: 'rl:global'  },
} as const;

// ─── In-memory fallback (dev / no Redis) ─────────────────────────────────────

interface MemoryEntry { count: number; resetAt: number }
const memoryStore = new Map<string, MemoryEntry>();

function parseWindowMs(window: string): number {
  const [val, unit] = window.split(' ');
  const n = parseInt(val);
  switch (unit) {
    case 's': return n * 1000;
    case 'm': return n * 60 * 1000;
    case 'h': return n * 60 * 60 * 1000;
    case 'd': return n * 24 * 60 * 60 * 1000;
    default:  return 60 * 1000;
  }
}

function memoryRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now    = Date.now();
  const windowMs = parseWindowMs(config.window);
  const entry  = memoryStore.get(key);

  if (!entry || now > entry.resetAt) {
    const resetAt = now + windowMs;
    memoryStore.set(key, { count: 1, resetAt });
    // Clean up old entries periodically
    if (memoryStore.size > 10_000) {
      for (const [k, v] of memoryStore.entries()) {
        if (now > v.resetAt) memoryStore.delete(k);
      }
    }
    return { success: true, limit: config.requests, remaining: config.requests - 1, reset: Math.ceil(resetAt / 1000) };
  }

  entry.count++;
  const remaining = Math.max(0, config.requests - entry.count);
  const success   = entry.count <= config.requests;

  return {
    success,
    limit: config.requests,
    remaining,
    reset: Math.ceil(entry.resetAt / 1000),
    retryAfter: success ? undefined : Math.ceil((entry.resetAt - now) / 1000),
  };
}

// ─── Upstash Redis rate limiter ───────────────────────────────────────────────

let redisClient: unknown = null;
let Ratelimit: unknown   = null;

async function getRedisRatelimit() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  if (!redisClient) {
    const { Redis }       = await import('@upstash/redis');
    const { Ratelimit: RL } = await import('@upstash/ratelimit');
    redisClient = new Redis({
      url:   process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    Ratelimit = RL;
  }
  return { redis: redisClient, Ratelimit };
}

async function upstashRateLimit(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
  const deps = await getRedisRatelimit();
  if (!deps) return memoryRateLimit(key, config);

  const { redis, Ratelimit: RL } = deps as {
    redis: unknown;
    Ratelimit: new (opts: unknown) => { limit: (id: string) => Promise<{ success: boolean; limit: number; remaining: number; reset: number }> };
  };

  // Parse window for Upstash format
  const [val, unit] = config.window.split(' ');
  const duration = `${val} ${unit === 's' ? 'second' : unit === 'm' ? 'minute' : unit === 'h' ? 'hour' : 'day'}${parseInt(val) > 1 ? 's' : ''}` as `${number} ${'ms' | 's' | 'm' | 'h' | 'd'}`;

  const ratelimit = new RL({
    redis,
    limiter: (RL as unknown as { slidingWindow: (r: number, d: string) => unknown }).slidingWindow 
      ? (RL as unknown as { slidingWindow: (r: number, d: string) => unknown }).slidingWindow(config.requests, duration)
      : { requests: config.requests, window: duration },
    prefix: config.prefix,
  });

  const result = await ratelimit.limit(key);
  return {
    success:    result.success,
    limit:      result.limit,
    remaining:  result.remaining,
    reset:      Math.ceil(result.reset / 1000),
    retryAfter: result.success ? undefined : Math.ceil((result.reset - Date.now()) / 1000),
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Rate limit by IP address
 * @param req - NextRequest object
 * @param config - Rate limit configuration (use RATE_LIMITS constants)
 */
export async function rateLimit(
  req: NextRequest,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const ip  = getClientIP(req);
  const key = `${config.prefix ?? 'rl'}:${ip}`;
  return upstashRateLimit(key, config);
}

/**
 * Rate limit by user ID (for authenticated endpoints)
 */
export async function rateLimitByUser(
  userId: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const key = `${config.prefix ?? 'rl'}:user:${userId}`;
  return upstashRateLimit(key, config);
}

/**
 * Rate limit by both IP and user (double protection)
 */
export async function rateLimitStrict(
  req: NextRequest,
  userId: string | undefined,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const [ipResult, userResult] = await Promise.all([
    rateLimit(req, config),
    userId ? rateLimitByUser(userId, { ...config, requests: config.requests * 2 }) : Promise.resolve(null),
  ]);

  // Fail if either check fails
  if (!ipResult.success) return ipResult;
  if (userResult && !userResult.success) return userResult;
  return ipResult;
}

// ─── IP extraction ────────────────────────────────────────────────────────────

export function getClientIP(req: NextRequest): string {
  // Try headers in priority order (Cloudflare → Vercel → standard → fallback)
  return (
    req.headers.get('cf-connecting-ip') ??        // Cloudflare
    req.headers.get('x-real-ip') ??               // Nginx/Vercel
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??  // Proxy chain
    req.ip ??                                      // Next.js built-in
    '127.0.0.1'
  );
}

// ─── Response helpers ─────────────────────────────────────────────────────────

/**
 * Build rate limit response headers (RFC 6585 compliant)
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit':     String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset':     String(result.reset),
    ...(result.retryAfter ? { 'Retry-After': String(result.retryAfter) } : {}),
  };
}

/**
 * Build a 429 Too Many Requests response
 */
export function tooManyRequestsResponse(result: RateLimitResult) {
  const { NextResponse } = require('next/server');
  return NextResponse.json(
    {
      error: 'Too many requests',
      message: `Rate limit exceeded. Try again in ${result.retryAfter ?? 60} seconds.`,
      retryAfter: result.retryAfter,
    },
    {
      status: 429,
      headers: rateLimitHeaders(result),
    }
  );
}
