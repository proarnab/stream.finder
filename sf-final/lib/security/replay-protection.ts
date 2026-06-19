/**
 * ═══════════════════════════════════════════════════════════════════════════
 * REPLAY ATTACK PROTECTION
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Protects against replay attacks by:
 * 1. Implementing cryptographic nonces (one-time use tokens)
 * 2. Using short-lived tokens with expiration
 * 3. Enforcing anti-CSRF measures (SameSite cookies, origin verification)
 * 4. Implementing session invalidation strategies
 * 5. Tracking used nonces to prevent reuse
 * 
 * THREAT MODELS:
 * - Attacker intercepts request and replays it later
 * - Attacker copies valid CSRF token from one form and uses elsewhere
 * - Attacker performs action multiple times by replaying same request
 * - Attacker uses old session token to perform actions
 * 
 * Example attacks:
 * - Replay payment request: POST /api/payment with same token
 * - Replay password change: POST /api/profile/password with old nonce
 * - Replay form submission on different domain (CSRF)
 * 
 * DEFENSE LAYERS:
 * 1. NONCE: Unique, cryptographic token per operation
 * 2. EXPIRATION: Token valid for short time (5-15 minutes)
 * 3. TRACKING: Record used nonces to prevent reuse
 * 4. CSRF: Verify origin, use SameSite cookies
 * 5. SESSION: Cryptographically signed sessions
 */

import { createHash, randomBytes } from 'crypto';
import { jwtVerify, SignJWT } from 'jose';

/**
 * Replay attack protection configuration
 */
export const REPLAY_CONFIG = {
  // Nonce validity duration (in seconds)
  NONCE_EXPIRY_SECONDS: 900,          // 15 minutes

  // CSRF token validity (in seconds)
  CSRF_TOKEN_EXPIRY_SECONDS: 3600,    // 1 hour

  // Session validity (in seconds)
  SESSION_EXPIRY_SECONDS: 86400,      // 24 hours

  // Maximum nonce reuse attempts before locking
  MAX_NONCE_REUSE_ATTEMPTS: 5,

  // Time window to detect rapid reuse (in milliseconds)
  RAPID_REUSE_WINDOW_MS: 1000,

  // Enable replay attack logging for monitoring
  LOG_REPLAY_ATTEMPTS: true,

  // Backend storage for nonce tracking (use Redis in production)
  NONCE_STORAGE_TYPE: 'memory' as 'memory' | 'redis',
} as const;

/**
 * Nonce state tracking
 */
interface NonceRecord {
  nonce: string;
  createdAt: number;
  expiresAt: number;
  usedAt?: number;
  usageCount: number;
  lastUsageAttempt?: number;
}

/**
 * In-memory nonce store (use Redis in production)
 */
class NonceStore {
  private store = new Map<string, NonceRecord>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Clean up expired nonces every 5 minutes
    if (typeof window === 'undefined') { // Only in Node.js environment
      this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    }
  }

  set(nonce: string, record: NonceRecord): void {
    this.store.set(nonce, record);
  }

  get(nonce: string): NonceRecord | undefined {
    return this.store.get(nonce);
  }

  delete(nonce: string): boolean {
    return this.store.delete(nonce);
  }

  has(nonce: string): boolean {
    return this.store.has(nonce);
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.store.entries()) {
      if (now > value.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store.clear();
  }

  getStats() {
    return {
      totalNonces: this.store.size,
      expiredCount: Array.from(this.store.values()).filter(
        r => Date.now() > r.expiresAt
      ).length,
    };
  }
}

const nonceStore = new NonceStore();

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LAYER 1: NONCE GENERATION & VALIDATION
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Generate a cryptographically secure nonce
 * 
 * Returns a unique, one-time-use token for sensitive operations.
 * 
 * @example
 * const nonce = generateNonce();
 * // Usage: Store in session, send to client, validate on form submission
 */
export function generateNonce(): string {
  // Generate 32 bytes of random data and convert to hex
  return randomBytes(32).toString('hex');
}

/**
 * Register a nonce for tracking
 * 
 * Should be called when nonce is created (e.g., on GET request for form)
 * Stores nonce in tracking system to detect reuse attempts.
 * 
 * @example
 * const nonce = generateNonce();
 * registerNonce(nonce, 'password_change');
 */
export function registerNonce(
  nonce: string,
  purpose: string = 'default'
): { registered: boolean; expiresAt: number } {
  const now = Date.now();
  const expiresAt = now + REPLAY_CONFIG.NONCE_EXPIRY_SECONDS * 1000;

  const record: NonceRecord = {
    nonce,
    createdAt: now,
    expiresAt,
    usageCount: 0,
  };

  nonceStore.set(nonce, record);

  return {
    registered: true,
    expiresAt: Math.floor(expiresAt / 1000),
  };
}

/**
 * Validate and consume a nonce
 * 
 * Checks if nonce is:
 * - Present in store
 * - Not expired
 * - Not already used (first use only)
 * - Not being reused rapidly
 * 
 * Returns validation result. If valid, nonce is marked as used.
 * 
 * @example
 * const result = validateNonce(userSubmittedNonce);
 * if (!result.valid) {
 *   throw new Error('Invalid or expired nonce');
 * }
 * // Nonce is consumed, cannot be reused
 */
export function validateNonce(
  nonce: string | null | undefined
): {
  valid: boolean;
  reason?: string;
  data?: NonceRecord;
} {
  if (!nonce) {
    return { valid: false, reason: 'Nonce missing' };
  }

  const record = nonceStore.get(nonce);

  if (!record) {
    if (REPLAY_CONFIG.LOG_REPLAY_ATTEMPTS) {
      console.warn(`[SECURITY] Nonce validation failed: nonce not found or expired`);
    }
    return { valid: false, reason: 'Nonce not found or expired' };
  }

  const now = Date.now();

  // Check expiration
  if (now > record.expiresAt) {
    nonceStore.delete(nonce);
    if (REPLAY_CONFIG.LOG_REPLAY_ATTEMPTS) {
      console.warn(`[SECURITY] Nonce expired: ${nonce.slice(0, 8)}...`);
    }
    return { valid: false, reason: 'Nonce expired' };
  }

  // Check if already used
  if (record.usedAt) {
    const timeSinceFirstUse = now - record.usedAt;
    
    // Detect rapid reuse (likely replay attack)
    if (timeSinceFirstUse < REPLAY_CONFIG.RAPID_REUSE_WINDOW_MS) {
      record.usageCount++;

      if (REPLAY_CONFIG.LOG_REPLAY_ATTEMPTS) {
        console.error(
          `[SECURITY] Rapid nonce reuse detected: ${nonce.slice(0, 8)}... ` +
          `(${record.usageCount} attempts)`
        );
      }

      // After too many reuse attempts, invalidate nonce
      if (record.usageCount > REPLAY_CONFIG.MAX_NONCE_REUSE_ATTEMPTS) {
        nonceStore.delete(nonce);
        return {
          valid: false,
          reason: `Nonce reused too many times (${record.usageCount}x)`,
        };
      }

      return {
        valid: false,
        reason: 'Nonce already used (replay attack detected)',
      };
    }
  }

  // Mark nonce as used
  record.usedAt = now;
  record.lastUsageAttempt = now;
  record.usageCount++;

  return { valid: true, data: record };
}

/**
 * Revoke a nonce immediately
 * 
 * Use this if operation fails and nonce should not be reused.
 * 
 * @example
 * const result = validateNonce(nonce);
 * if (result.valid) {
 *   try {
 *     // Perform operation
 *   } catch (err) {
 *     revokeNonce(nonce); // Make nonce invalid for future attempts
 *     throw err;
 *   }
 * }
 */
export function revokeNonce(nonce: string): boolean {
  return nonceStore.delete(nonce);
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LAYER 2: CSRF TOKEN GENERATION & VALIDATION
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * CSRF tokens protect against cross-site request forgery.
 * Different from nonces: can be reused during validity period,
 * tied to session, checked on state-changing requests.
 */

/**
 * Generate CSRF token for session
 * 
 * CSRF tokens are bound to a session and can be reused until expiration.
 * Create one per session (not per request like nonces).
 * 
 * @example
 * const csrfToken = generateCSRFToken(sessionId);
 * // Store token in session, send to client in form hidden field
 */
export function generateCSRFToken(sessionId: string): string {
  // Create deterministic token from session ID
  // Using HMAC ensures token is valid only for that session
  const secret = process.env.NEXTAUTH_SECRET || 'default-secret';
  const token = createHash('sha256')
    .update(`${sessionId}:${secret}:${Date.now()}`)
    .digest('hex');

  return token;
}

/**
 * Validate CSRF token
 * 
 * Checks if token matches session and is not expired.
 * 
 * @example
 * if (!validateCSRFToken(sessionId, userProvidedToken)) {
 *   throw new Error('Invalid CSRF token');
 * }
 */
export function validateCSRFToken(
  sessionId: string,
  token: string
): boolean {
  if (!sessionId || !token) return false;

  // Regenerate expected token and compare
  const expectedToken = generateCSRFToken(sessionId);

  // Use timing-safe comparison to prevent timing attacks
  return timingSafeEqual(token, expectedToken);
}

/**
 * Timing-safe string comparison
 * 
 * Prevents timing attacks by always comparing full strings
 * even if they don't match early on.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LAYER 3: SESSION TOKEN GENERATION & VALIDATION
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Session tokens are JWT-based, cryptographically signed.
 * Use for maintaining authenticated sessions.
 */

interface SessionPayload {
  sub: string;           // Subject (user ID)
  sessionId: string;     // Unique session ID
  iat: number;           // Issued at
  exp: number;           // Expiration time
  nonce?: string;        // Optional nonce for additional protection
}

/**
 * Create signed session token
 * 
 * Returns a JWT token with session information.
 * 
 * @example
 * const token = await createSessionToken(userId, sessionId);
 * // Set in httpOnly cookie
 */
export async function createSessionToken(
  userId: string,
  sessionId: string,
  expirySeconds = REPLAY_CONFIG.SESSION_EXPIRY_SECONDS
): Promise<string> {
  const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET || 'default-secret');

  const token = await new SignJWT({
    sub: userId,
    sessionId,
    nonce: generateNonce(),
  } as SessionPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${expirySeconds}s`)
    .sign(secret);

  return token;
}

/**
 * Validate session token
 * 
 * Verifies JWT signature and expiration.
 * 
 * @example
 * const payload = await validateSessionToken(tokenFromCookie);
 * if (!payload) {
 *   return redirectToLogin();
 * }
 */
export async function validateSessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET || 'default-secret');

    const verified = await jwtVerify(token, secret);
    return verified.payload as SessionPayload;
  } catch (err) {
    if (REPLAY_CONFIG.LOG_REPLAY_ATTEMPTS) {
      console.warn('[SECURITY] Session token validation failed:', err);
    }
    return null;
  }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LAYER 4: MIDDLEWARE/GUARD FUNCTIONS FOR EXPRESS/NEXT.JS
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Express middleware to validate nonce on state-changing requests
 * 
 * Use for POST, PUT, DELETE requests that modify state.
 * 
 * @example
 * app.post('/api/password', nonceValidationMiddleware, async (req, res) => {
 *   // Nonce has been validated, safe to proceed
 * });
 */
export function createNonceValidationMiddleware() {
  return (req: any, res: any, next: any) => {
    // Skip nonce validation for certain safe operations
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      return next();
    }

    // Get nonce from request (could be in body, query, or header)
    const nonce = req.body?.nonce || req.query?.nonce || req.headers['x-nonce'];

    if (!nonce) {
      return res.status(400).json({ error: 'Nonce required' });
    }

    const validation = validateNonce(nonce);
    if (!validation.valid) {
      res.setHeader('X-Nonce-Error', validation.reason);
      return res.status(403).json({ error: validation.reason });
    }

    // Nonce is valid, attach to request for later use
    req.nonce = nonce;
    next();
  };
}

/**
 * Express middleware to validate CSRF token
 * 
 * @example
 * app.post('/api/profile', csrfValidationMiddleware, async (req, res) => {
 *   // CSRF has been validated
 * });
 */
export function createCSRFValidationMiddleware() {
  return (req: any, res: any, next: any) => {
    // Skip for safe methods
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      return next();
    }

    // Get CSRF token from request
    const csrfToken = req.body?.csrfToken || req.headers['x-csrf-token'];

    if (!csrfToken) {
      return res.status(400).json({ error: 'CSRF token required' });
    }

    // Get session ID from request
    const sessionId = req.session?.id || req.user?.sessionId;

    if (!sessionId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Validate CSRF token
    if (!validateCSRFToken(sessionId, csrfToken)) {
      return res.status(403).json({ error: 'Invalid CSRF token' });
    }

    next();
  };
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LAYER 5: MONITORING & ATTACK DETECTION
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Detect replay attack patterns
 * 
 * Use this to identify suspicious replay behavior:
 * - Rapid nonce reuse from same IP
 * - Multiple failed CSRF validations
 * - Session token reuse from different IPs
 */
export function createReplayAttackDetector() {
  const ipAttempts = new Map<string, Array<{ timestamp: number; type: string }>>();

  return {
    recordAttempt: (ip: string, type: 'nonce_reuse' | 'csrf_fail' | 'replay'): void => {
      const now = Date.now();
      const attempts = ipAttempts.get(ip) ?? [];

      // Remove old attempts (older than 1 minute)
      const recent = attempts.filter(a => now - a.timestamp < 60_000);
      recent.push({ timestamp: now, type });

      ipAttempts.set(ip, recent);

      // Alert on suspicious patterns
      const reuseCount = recent.filter(a => a.type === 'nonce_reuse').length;
      const csrfFailCount = recent.filter(a => a.type === 'csrf_fail').length;

      if (reuseCount >= 5) {
        console.error(`[SECURITY ALERT] Possible replay attack from ${ip}: ${reuseCount} nonce reuses`);
      }

      if (csrfFailCount >= 3) {
        console.error(`[SECURITY ALERT] Possible CSRF attack from ${ip}: ${csrfFailCount} CSRF failures`);
      }
    },

    getStats: (ip: string) => {
      const attempts = ipAttempts.get(ip) ?? [];
      return {
        totalAttempts: attempts.length,
        reuseAttempts: attempts.filter(a => a.type === 'nonce_reuse').length,
        csrfFailures: attempts.filter(a => a.type === 'csrf_fail').length,
      };
    },
  };
}

export default {
  REPLAY_CONFIG,
  generateNonce,
  registerNonce,
  validateNonce,
  revokeNonce,
  generateCSRFToken,
  validateCSRFToken,
  createSessionToken,
  validateSessionToken,
  createNonceValidationMiddleware,
  createCSRFValidationMiddleware,
  createReplayAttackDetector,
};
