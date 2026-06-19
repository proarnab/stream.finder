/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LOGICAL & APPLICATION-LAYER DOS (LP DoS) PROTECTION
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Protects against application-layer denial of service attacks by:
 * 1. Implementing strict rate limiting per endpoint and user
 * 2. Enforcing request timeouts
 * 3. Limiting payload sizes
 * 4. Implementing computational complexity budgets
 * 5. Monitoring resource consumption patterns
 * 
 * THREAT MODELS:
 * - Slow POST attacks with large payloads
 * - Expensive search queries (regex, full-text search)
 * - Nested relationship queries (N+1 problem)
 * - Bulk operations without pagination limits
 * - Memory exhaustion through large requests
 * 
 * Common LP DoS vectors:
 * - Uploading huge files
 * - Submitting forms with thousands of fields
 * - Complex nested object structures
 * - Expensive database queries
 * - Concurrent connection exhaustion
 */

import { RateLimitResult } from '@/lib/ratelimit';

/**
 * Global LP DoS configuration
 */
export const LPDOS_CONFIG = {
  // Request size limits
  MAX_JSON_SIZE: 1_000_000,           // 1 MB
  MAX_URL_LENGTH: 2048,               // 2 KB
  MAX_HEADER_SIZE: 8192,              // 8 KB
  MAX_QUERY_STRING_SIZE: 4096,        // 4 KB

  // Request timeout limits (milliseconds)
  API_TIMEOUT_MS: 30_000,             // 30 seconds for API calls
  UPLOAD_TIMEOUT_MS: 120_000,         // 120 seconds for uploads
  SEARCH_TIMEOUT_MS: 15_000,          // 15 seconds for searches

  // Computational complexity budgets
  MAX_QUERY_COMPLEXITY: 100,          // Arbitrary units
  MAX_ARRAY_LENGTH: 1000,             // Max items in array
  MAX_OBJECT_DEPTH: 20,               // Max nesting levels
  MAX_OBJECT_KEYS: 100,               // Max keys per object

  // Connection limits
  MAX_CONCURRENT_REQUESTS_PER_IP: 50,
  MAX_CONCURRENT_REQUESTS_PER_USER: 20,

  // Queue/backpressure settings
  QUEUE_MAX_SIZE: 1000,               // Max items in queue
  QUEUE_PROCESSING_TIMEOUT_MS: 5000,  // Max time to process queued item

  // Monitoring thresholds
  ALERT_THRESHOLD_CPU_MS: 1000,       // Alert if request takes >1s CPU
  ALERT_THRESHOLD_MEMORY_MB: 100,     // Alert if request uses >100MB memory
} as const;

/**
 * Request complexity tracker
 */
export interface ComplexityBudget {
  total: number;
  spent: number;
  remaining: number;
  exceeded: boolean;
}

/**
 * Request resource usage metrics
 */
export interface RequestMetrics {
  startTime: number;
  endTime?: number;
  duration?: number;
  cpuTime?: number;
  memoryUsed?: number;
  allocations?: number;
  complexityBudget: ComplexityBudget;
  payloadSize: number;
}

/**
 * Track active requests to enforce concurrency limits
 */
class RequestTracker {
  private requestsByIP = new Map<string, number>();
  private requestsByUser = new Map<string, number>();

  incrementIP(ip: string): number {
    const count = (this.requestsByIP.get(ip) ?? 0) + 1;
    this.requestsByIP.set(ip, count);
    return count;
  }

  decrementIP(ip: string): void {
    const count = (this.requestsByIP.get(ip) ?? 1) - 1;
    if (count <= 0) {
      this.requestsByIP.delete(ip);
    } else {
      this.requestsByIP.set(ip, count);
    }
  }

  incrementUser(userId: string): number {
    const count = (this.requestsByUser.get(userId) ?? 0) + 1;
    this.requestsByUser.set(userId, count);
    return count;
  }

  decrementUser(userId: string): void {
    const count = (this.requestsByUser.get(userId) ?? 1) - 1;
    if (count <= 0) {
      this.requestsByUser.delete(userId);
    } else {
      this.requestsByUser.set(userId, count);
    }
  }

  getIPCount(ip: string): number {
    return this.requestsByIP.get(ip) ?? 0;
  }

  getUserCount(userId: string): number {
    return this.requestsByUser.get(userId) ?? 0;
  }
}

const requestTracker = new RequestTracker();

/**
 * GUARD: Check if request would exceed concurrency limits
 * 
 * Returns error if IP or user has too many simultaneous requests.
 * Call incrementIP/incrementUser after this check passes.
 * 
 * @example
 * const check = checkConcurrencyLimits('203.0.113.5', 'user123');
 * if (!check.allowed) {
 *   return sendTooBusyResponse();
 * }
 */
export function checkConcurrencyLimits(
  ip: string,
  userId?: string
): { allowed: boolean; reason?: string; retryAfter?: number } {
  const ipCount = requestTracker.getIPCount(ip);
  if (ipCount >= LPDOS_CONFIG.MAX_CONCURRENT_REQUESTS_PER_IP) {
    return {
      allowed: false,
      reason: `Too many concurrent requests from IP (max ${LPDOS_CONFIG.MAX_CONCURRENT_REQUESTS_PER_IP})`,
      retryAfter: 5,
    };
  }

  if (userId) {
    const userCount = requestTracker.getUserCount(userId);
    if (userCount >= LPDOS_CONFIG.MAX_CONCURRENT_REQUESTS_PER_USER) {
      return {
        allowed: false,
        reason: `Too many concurrent requests for user (max ${LPDOS_CONFIG.MAX_CONCURRENT_REQUESTS_PER_USER})`,
        retryAfter: 5,
      };
    }
  }

  return { allowed: true };
}

/**
 * GUARD: Register incoming request for concurrency tracking
 * 
 * @example
 * const tracker = registerRequest(ip, userId);
 * try {
 *   // Handle request
 * } finally {
 *   tracker.cleanup();
 * }
 */
export function registerRequest(ip: string, userId?: string) {
  requestTracker.incrementIP(ip);
  if (userId) {
    requestTracker.incrementUser(userId);
  }

  return {
    cleanup: () => {
      requestTracker.decrementIP(ip);
      if (userId) {
        requestTracker.decrementUser(userId);
      }
    },
  };
}

/**
 * GUARD: Validate request payload size
 * 
 * Prevents large POST bodies, file uploads, etc. from consuming resources.
 * 
 * @example
 * const result = validatePayloadSize(jsonBody, 'application/json');
 * if (!result.valid) {
 *   return response.status(413).json({ error: result.reason });
 * }
 */
export function validatePayloadSize(
  payload: unknown,
  contentType: string
): { valid: boolean; reason?: string; size: number } {
  let size = 0;

  if (typeof payload === 'string') {
    size = new TextEncoder().encode(payload).byteLength;
  } else if (payload instanceof ArrayBuffer) {
    size = payload.byteLength;
  } else if (typeof payload === 'object') {
    size = new TextEncoder().encode(JSON.stringify(payload)).byteLength;
  }

  const limit = contentType.includes('application/json')
    ? LPDOS_CONFIG.MAX_JSON_SIZE
    : LPDOS_CONFIG.MAX_JSON_SIZE;

  return {
    valid: size <= limit,
    reason: size > limit ? `Payload too large (${size} bytes, max ${limit})` : undefined,
    size,
  };
}

/**
 * GUARD: Validate object complexity to prevent DoS through deep nesting
 * 
 * Checks for:
 * - Excessive nesting depth
 * - Too many keys in objects
 * - Too many items in arrays
 * 
 * @example
 * const complexity = validateObjectComplexity(userSubmittedData);
 * if (complexity.exceeded) {
 *   throw new Error(`Object structure too complex: ${complexity.reason}`);
 * }
 */
export function validateObjectComplexity(
  obj: unknown,
  depth = 0,
  stats = { objects: 0, arrays: 0, keys: 0 }
): { exceeded: boolean; reason?: string; stats: typeof stats } {
  // Check depth limit
  if (depth > LPDOS_CONFIG.MAX_OBJECT_DEPTH) {
    return {
      exceeded: true,
      reason: `Object nesting depth exceeded (max ${LPDOS_CONFIG.MAX_OBJECT_DEPTH})`,
      stats,
    };
  }

  if (obj === null || typeof obj !== 'object') {
    return { exceeded: false, stats };
  }

  if (Array.isArray(obj)) {
    stats.arrays++;
    if (obj.length > LPDOS_CONFIG.MAX_ARRAY_LENGTH) {
      return {
        exceeded: true,
        reason: `Array too large (${obj.length} items, max ${LPDOS_CONFIG.MAX_ARRAY_LENGTH})`,
        stats,
      };
    }

    // Recursively check array items
    for (const item of obj) {
      const check = validateObjectComplexity(item, depth + 1, stats);
      if (check.exceeded) return check;
    }
  } else {
    stats.objects++;
    const keys = Object.keys(obj);
    if (keys.length > LPDOS_CONFIG.MAX_OBJECT_KEYS) {
      return {
        exceeded: true,
        reason: `Object has too many keys (${keys.length}, max ${LPDOS_CONFIG.MAX_OBJECT_KEYS})`,
        stats,
      };
    }

    // Recursively check object values
    for (const key of keys) {
      const check = validateObjectComplexity((obj as Record<string, unknown>)[key], depth + 1, stats);
      if (check.exceeded) return check;
    }
  }

  return { exceeded: false, stats };
}

/**
 * GUARD: Create a complexity budget for a request
 * 
 * Tracks "complexity units" as the request performs operations.
 * When budget is exceeded, request is terminated.
 * 
 * Complexity costs (example values):
 * - Simple query: 1 unit
 * - Join operation: 5 units
 * - Full-text search: 10 units
 * - Sort operation: 3 units
 * - Regex validation: 2 units
 * 
 * @example
 * const budget = createComplexityBudget(20); // 20 units for this request
 * budget.spend(3); // Cost of a join
 * if (!budget.hasRemaining(5)) {
 *   throw new Error('Request too complex');
 * }
 */
export function createComplexityBudget(totalUnits: number) {
  let spent = 0;

  return {
    spend: (units: number): boolean => {
      spent += units;
      return spent <= totalUnits;
    },

    remaining: (): number => Math.max(0, totalUnits - spent),

    hasRemaining: (units: number): boolean => {
      return spent + units <= totalUnits;
    },

    exceeded: (): boolean => spent > totalUnits,

    getStats: (): ComplexityBudget => ({
      total: totalUnits,
      spent,
      remaining: Math.max(0, totalUnits - spent),
      exceeded: spent > totalUnits,
    }),

    assert: (units: number, label = 'operation'): void => {
      if (spent + units > totalUnits) {
        throw new Error(
          `Request complexity exceeded: ${label} (${spent + units}/${totalUnits} units)`
        );
      }
      spent += units;
    },
  };
}

/**
 * GUARD: Timeout wrapper for async operations
 * 
 * Ensures any async operation completes within specified time.
 * Useful for database queries, API calls, etc.
 * 
 * @example
 * const result = await withTimeout(
 *   expensiveQuery(),
 *   LPDOS_CONFIG.SEARCH_TIMEOUT_MS,
 *   'Database search'
 * );
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label = 'Operation'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
        timeoutMs
      )
    ),
  ]);
}

/**
 * GUARD: Validate URL length to prevent ReDoS-like attacks on parsing
 * 
 * Very long URLs can cause performance issues in URL parsing.
 */
export function validateUrlLength(url: string): { valid: boolean; reason?: string } {
  if (url.length > LPDOS_CONFIG.MAX_URL_LENGTH) {
    return {
      valid: false,
      reason: `URL too long (${url.length} bytes, max ${LPDOS_CONFIG.MAX_URL_LENGTH})`,
    };
  }
  return { valid: true };
}

/**
 * GUARD: Validate query string length
 */
export function validateQueryStringSize(qs: string): { valid: boolean; reason?: string } {
  if (qs.length > LPDOS_CONFIG.MAX_QUERY_STRING_SIZE) {
    return {
      valid: false,
      reason: `Query string too long (${qs.length} bytes, max ${LPDOS_CONFIG.MAX_QUERY_STRING_SIZE})`,
    };
  }
  return { valid: true };
}

/**
 * MONITORING: Track request metrics for suspicious patterns
 * 
 * Use this to log and detect DoS patterns:
 * - High request volume from single IP
 * - Consistently slow requests
 * - High memory/CPU consumption
 * 
 * @example
 * const metrics = startMetrics(JSON.stringify(body).length);
 * // ... handle request
 * const final = metrics.end();
 * if (final.duration > 5000) {
 *   console.warn('Slow request:', final);
 * }
 */
export function startMetrics(payloadSize: number): {
  end: () => RequestMetrics;
  complexityBudget: ReturnType<typeof createComplexityBudget>;
} {
  const startTime = Date.now();
  const complexityBudget = createComplexityBudget(LPDOS_CONFIG.MAX_QUERY_COMPLEXITY);

  return {
    end: () => ({
      startTime,
      endTime: Date.now(),
      duration: Date.now() - startTime,
      cpuTime: 0, // Would need perf hooks in production
      memoryUsed: 0, // Would need memory profiling
      allocations: 0,
      complexityBudget: complexityBudget.getStats(),
      payloadSize,
    }),
    complexityBudget,
  };
}

/**
 * HELPER: Rate limiter integration with LP DoS tracking
 * 
 * Combine rate limiting with LP DoS protection:
 * - Rate limit is enforced per user/IP
 * - Additional checks for payload size, complexity
 * 
 * @example
 * const result = checkLPDoSLimits(rateLimitResult, ip, userId, payload);
 * if (!result.allowed) {
 *   return response.status(429).json({ error: result.reason });
 * }
 */
export function checkLPDoSLimits(
  rateLimitResult: RateLimitResult,
  ip: string,
  userId: string | undefined,
  payload: unknown,
  contentType: string
): { allowed: boolean; reason?: string; retryAfter?: number } {
  // Check rate limit first
  if (!rateLimitResult.success) {
    return {
      allowed: false,
      reason: 'Rate limit exceeded',
      retryAfter: rateLimitResult.retryAfter,
    };
  }

  // Check concurrency
  const concurrencyCheck = checkConcurrencyLimits(ip, userId);
  if (!concurrencyCheck.allowed) {
    return concurrencyCheck;
  }

  // Check payload size
  const sizeCheck = validatePayloadSize(payload, contentType);
  if (!sizeCheck.valid) {
    return { allowed: false, reason: sizeCheck.reason };
  }

  return { allowed: true };
}

export default {
  LPDOS_CONFIG,
  checkConcurrencyLimits,
  registerRequest,
  validatePayloadSize,
  validateObjectComplexity,
  createComplexityBudget,
  withTimeout,
  validateUrlLength,
  validateQueryStringSize,
  startMetrics,
  checkLPDoSLimits,
};
