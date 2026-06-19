// lib/captcha.ts
// Supports two CAPTCHA providers — pick ONE and configure it:
//
// Option A: hCaptcha (recommended for privacy-first)
//   → https://www.hcaptcha.com — free tier available
//   → Set CAPTCHA_PROVIDER=hcaptcha, HCAPTCHA_SECRET_KEY=...
//
// Option B: Cloudflare Turnstile (invisible, no user friction)
//   → https://www.cloudflare.com/products/turnstile — completely free
//   → Set CAPTCHA_PROVIDER=turnstile, TURNSTILE_SECRET_KEY=...
//
// Both are privacy-respecting alternatives to reCAPTCHA (no Google tracking)

export type CaptchaProvider = 'hcaptcha' | 'turnstile' | 'none';

export interface CaptchaVerifyResult {
  success: boolean;
  error?: string;
  score?: number;    // Turnstile risk score (0.0–1.0, higher = more human)
  provider: CaptchaProvider;
}

// ─── Provider detection ───────────────────────────────────────────────────────

export function getCaptchaProvider(): CaptchaProvider {
  const p = process.env.CAPTCHA_PROVIDER?.toLowerCase();
  if (p === 'hcaptcha')  return 'hcaptcha';
  if (p === 'turnstile') return 'turnstile';
  return 'none'; // no captcha configured (dev mode)
}

export function getCaptchaSiteKey(): string {
  const provider = getCaptchaProvider();
  if (provider === 'hcaptcha')  return process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY  ?? '';
  if (provider === 'turnstile') return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';
  return '';
}

// ─── Server-side verification ──────────────────────────────────────────────────

/**
 * Verify a CAPTCHA token on the server.
 * Call this inside any API route that handles form submissions.
 *
 * @param token - The token sent from the client widget
 * @param ip    - Client IP (optional, improves accuracy)
 */
export async function verifyCaptcha(
  token: string | null | undefined,
  ip?: string
): Promise<CaptchaVerifyResult> {
  const provider = getCaptchaProvider();

  // Skip verification in dev if not configured
  if (provider === 'none') {
    if (process.env.NODE_ENV === 'production') {
      return { success: false, error: 'CAPTCHA not configured', provider };
    }
    return { success: true, provider }; // allow in dev
  }

  if (!token) {
    return { success: false, error: 'CAPTCHA token missing', provider };
  }

  try {
    if (provider === 'hcaptcha') {
      return await verifyHCaptcha(token, ip);
    }
    if (provider === 'turnstile') {
      return await verifyTurnstile(token, ip);
    }
  } catch (err) {
    console.error('CAPTCHA verification error:', err);
    return { success: false, error: 'CAPTCHA verification failed', provider };
  }

  return { success: false, error: 'Unknown provider', provider };
}

// ─── hCaptcha ─────────────────────────────────────────────────────────────────

async function verifyHCaptcha(token: string, ip?: string): Promise<CaptchaVerifyResult> {
  const secretKey = process.env.HCAPTCHA_SECRET_KEY;
  if (!secretKey) return { success: false, error: 'hCaptcha secret key not configured', provider: 'hcaptcha' };

  const params = new URLSearchParams({
    secret:   secretKey,
    response: token,
    ...(ip ? { remoteip: ip } : {}),
  });

  const res = await fetch('https://hcaptcha.com/siteverify', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    params.toString(),
  });

  const data = await res.json() as {
    success: boolean;
    'error-codes'?: string[];
    score?: number;
  };

  return {
    success:  data.success,
    error:    data.success ? undefined : (data['error-codes']?.[0] ?? 'hCaptcha failed'),
    score:    data.score,
    provider: 'hcaptcha',
  };
}

// ─── Cloudflare Turnstile ─────────────────────────────────────────────────────

async function verifyTurnstile(token: string, ip?: string): Promise<CaptchaVerifyResult> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  if (!secretKey) return { success: false, error: 'Turnstile secret key not configured', provider: 'turnstile' };

  const params = new URLSearchParams({
    secret:   secretKey,
    response: token,
    ...(ip ? { remoteip: ip } : {}),
  });

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    params.toString(),
  });

  const data = await res.json() as {
    success: boolean;
    'error-codes'?: string[];
    score?: number;
  };

  return {
    success:  data.success,
    error:    data.success ? undefined : (data['error-codes']?.[0] ?? 'Turnstile failed'),
    score:    data.score,
    provider: 'turnstile',
  };
}

// ─── Middleware helper ────────────────────────────────────────────────────────

/**
 * Extract CAPTCHA token from request body or header.
 * Checks: request body field "captchaToken", header "x-captcha-token"
 */
export async function extractCaptchaToken(req: Request): Promise<string | null> {
  // Try header first (for fetch-based API calls)
  const headerToken = req.headers.get('x-captcha-token');
  if (headerToken) return headerToken;

  // Try body (for form submissions) — clone to not consume body stream
  try {
    const cloned = req.clone();
    const body   = await cloned.json() as Record<string, unknown>;
    if (typeof body.captchaToken === 'string') return body.captchaToken;
  } catch { /* body might not be JSON */ }

  return null;
}
