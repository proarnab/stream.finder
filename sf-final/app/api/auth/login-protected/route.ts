// app/api/auth/login/route.ts
// Example: Email/password login with rate limiting + CAPTCHA
import { NextRequest, NextResponse } from 'next/server';
import { signIn } from 'next-auth/react';
import { z } from 'zod';
import { rateLimitStrict, tooManyRequestsResponse, getClientIP } from '@/lib/ratelimit';
import { verifyCaptcha, extractCaptchaToken } from '@/lib/captcha';
import { RATE_LIMITS } from '@/lib/ratelimit';
import { detectBot } from '@/lib/botdetection';

const schema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
  captchaToken: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const ip = getClientIP(req);

  // 1. CAPTCHA verification (if enabled)
  const captchaToken = await extractCaptchaToken(req);
  const captchaResult = await verifyCaptcha(captchaToken, ip);

  if (!captchaResult.success) {
    return NextResponse.json(
      { error: 'CAPTCHA verification failed', details: captchaResult.error },
      { status: 400 }
    );
  }

  // 2. Parse body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.errors },
      { status: 400 }
    );
  }

  // 3. Rate limiting (strict: IP + email combo)
  // This prevents brute force against a specific email address
  const emailRateLimit = await rateLimitStrict(
    req,
    undefined, // no user ID at login time
    { ...RATE_LIMITS.LOGIN, prefix: `rl:login:${parsed.data.email}` }
  );

  if (!emailRateLimit.success) {
    return tooManyRequestsResponse(emailRateLimit);
  }

  // 4. Bot detection (warn on score, but allow)
  const botDetection = detectBot(req);
  if (botDetection.isBot && botDetection.confidence > 0.7) {
    console.warn(`[SECURITY] Possible bot login attempt from ${ip}: ${botDetection.reason}`);
    // You could reject here or require additional verification
    // return NextResponse.json({ error: 'Suspicious activity detected' }, { status: 403 });
  }

  // 5. Attempt login (delegate to NextAuth)
  // Note: In a real implementation, you'd call your own credential verification
  // This is a simplified example
  try {
    // This would be your actual login logic
    // For now, we'll return an example response
    return NextResponse.json({
      ok: true,
      message: 'Login successful. Redirect to /dashboard',
    });
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json(
      { error: 'Login failed', details: 'Invalid credentials' },
      { status: 401 }
    );
  }
}
