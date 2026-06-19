/**
 * ═══════════════════════════════════════════════════════════════════════════
 * COMPREHENSIVE SECURITY INTEGRATION GUIDE
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * This document shows how to integrate all security modules into your
 * Next.js + Prisma + NextAuth application.
 * 
 * SECURITY LAYER ARCHITECTURE:
 * 
 * 1. REQUEST LAYER (middleware.ts)
 *    - Rate limiting
 *    - Bot detection
 *    - CSRF validation
 *    - Attack probe detection
 * 
 * 2. HEADER LAYER (next.config.js)
 *    - CSP
 *    - HSTS
 *    - X-Frame-Options
 *    - Secure Cookie attributes
 * 
 * 3. INPUT VALIDATION LAYER (API routes)
 *    - Zod schema validation
 *    - Type casting
 *    - Suspicious pattern detection
 * 
 * 4. DATA LAYER (database operations)
 *    - Parameterized queries (Prisma)
 *    - ORM safety
 * 
 * 5. SESSION LAYER (auth)
 *    - Nonces (one-time use tokens)
 *    - CSRF tokens
 *    - Session tokens with expiration
 * 
 * 6. CLIENT LAYER (forms & paste handling)
 *    - Clipboard sanitization
 *    - Input escaping
 *    - Secure form handling
 */

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 1. MIDDLEWARE SETUP (middleware.ts)
 * ═══════════════════════════════════════════════════════════════════════════
 */

export const MIDDLEWARE_EXAMPLE = `
// middleware.ts
import { NextResponse, NextRequest } from 'next/server';
import { rateLimit } from '@/lib/ratelimit';
import { getClientIP } from '@/lib/ratelimit';
import { getSecurityHeadersConfig } from '@/lib/security/security-headers';

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const ip = getClientIP(req);
  
  const response = NextResponse.next();

  // ──── Add Security Headers ────────────────────────────────────────────────
  const headers = getSecurityHeadersConfig();
  for (const { key, value } of headers) {
    response.headers.set(key, value);
  }

  // ──── Rate Limiting ────────────────────────────────────────────────────
  if (pathname.startsWith('/api/search')) {
    const result = await rateLimit(ip, 'SEARCH');
    if (!result.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { 
          status: 429,
          headers: {
            'Retry-After': String(result.retryAfter),
          }
        }
      );
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!.+\\\\.[\\\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
};
`;

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 2. API ROUTE SETUP — Secure Search Endpoint
 * ═══════════════════════════════════════════════════════════════════════════
 */

export const SECURE_SEARCH_ROUTE = `
// app/api/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { SearchQuerySchema, isSuspiciousSQLInput } from '@/lib/security/injection-protection';
import { validatePayloadSize, checkLPDoSLimits } from '@/lib/security/lpdos-protection';
import { withTimeout } from '@/lib/security/lpdos-protection';
import { rateLimit, getClientIP } from '@/lib/ratelimit';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const ip = getClientIP(req);
    const { searchParams } = new URL(req.url);

    // ──── 1. RATE LIMITING ────────────────────────────────────────────────
    const rateLimitResult = await rateLimit(ip, 'SEARCH');
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429, headers: { 'Retry-After': String(rateLimitResult.retryAfter) } }
      );
    }

    // ──── 2. INPUT VALIDATION (Zod Schema) ────────────────────────────────
    const queryData = {
      q: searchParams.get('q'),
      limit: parseInt(searchParams.get('limit') || '20'),
      offset: parseInt(searchParams.get('offset') || '0'),
    };

    const validated = SearchQuerySchema.parse(queryData);

    // ──── 3. INJECTION DETECTION (Defense-in-depth) ──────────────────────
    if (isSuspiciousSQLInput(validated.q)) {
      return NextResponse.json(
        { error: 'Invalid search query' },
        { status: 400 }
      );
    }

    // ──── 4. LPDOS PROTECTION ────────────────────────────────────────────
    const sizeCheck = validatePayloadSize(validated, 'application/json');
    if (!sizeCheck.valid) {
      return NextResponse.json(
        { error: sizeCheck.reason },
        { status: 413 }
      );
    }

    // ──── 5. SEARCH WITH TIMEOUT ─────────────────────────────────────────
    const results = await withTimeout(
      prisma.movie.findMany({
        where: {
          OR: [
            { title: { contains: validated.q, mode: 'insensitive' } },
            { description: { contains: validated.q, mode: 'insensitive' } },
          ],
        },
        skip: validated.offset,
        take: validated.limit,
        select: {
          id: true,
          title: true,
          description: true,
          posterUrl: true,
          rating: true,
        },
      }),
      15000, // 15 second timeout
      'Movie search'
    );

    return NextResponse.json(results);

  } catch (error) {
    console.error('[API] Search error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request parameters' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    );
  }
}
`;

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 3. FORM SUBMISSION — Secure Review Submission
 * ═══════════════════════════════════════════════════════════════════════════
 */

export const SECURE_FORM_ROUTE = `
// app/api/reviews/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { ReviewSchema } from '@/lib/security/injection-protection';
import { validateNonce } from '@/lib/security/replay-protection';
import { validateCSRFToken } from '@/lib/security/replay-protection';
import { sanitizeClipboardContent } from '@/lib/security/clipboard-protection';
import { verifyCaptcha } from '@/lib/captcha';
import { rateLimit, getClientIP } from '@/lib/ratelimit';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    // ──── 1. AUTHENTICATION ──────────────────────────────────────────────
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // ──── 2. RATE LIMITING ───────────────────────────────────────────────
    const ip = getClientIP(req);
    const rateLimitResult = await rateLimit(ip, 'REVIEW_SUBMIT');
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    const body = await req.json();

    // ──── 3. CSRF & NONCE VALIDATION ─────────────────────────────────────
    const nonceValid = validateNonce(body.nonce);
    if (!nonceValid.valid) {
      return NextResponse.json(
        { error: nonceValid.reason },
        { status: 403 }
      );
    }

    if (!validateCSRFToken(session.user.id, body.csrfToken)) {
      return NextResponse.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      );
    }

    // ──── 4. CAPTCHA VERIFICATION ────────────────────────────────────────
    const captchaResult = await verifyCaptcha(body.captchaToken, ip);
    if (!captchaResult.success) {
      return NextResponse.json(
        { error: 'CAPTCHA verification failed' },
        { status: 400 }
      );
    }

    // ──── 5. INPUT VALIDATION (Zod) ──────────────────────────────────────
    const validated = ReviewSchema.parse({
      movieId: body.movieId,
      rating: body.rating,
      title: body.title,
      content: body.content,
      spoilers: body.spoilers,
    });

    // ──── 6. CLIPBOARD SANITIZATION (if pasted) ──────────────────────────
    if (body.wasPasted) {
      const sanitized = await sanitizeClipboardContent(body.content);
      if (!sanitized.valid) {
        return NextResponse.json(
          { error: 'Clipboard content invalid' },
          { status: 400 }
        );
      }
      validated.content = sanitized.clean;
    }

    // ──── 7. DATABASE INSERT (Parameterized Query via Prisma) ───────────
    const review = await prisma.review.create({
      data: {
        movieId: parseInt(validated.movieId),
        userId: session.user.id,
        rating: validated.rating,
        title: validated.title,
        content: validated.content,
        spoilers: validated.spoilers,
      },
    });

    return NextResponse.json(
      { success: true, reviewId: review.id },
      { status: 201 }
    );

  } catch (error) {
    console.error('[API] Review submission error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid review data' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Review submission failed' },
      { status: 500 }
    );
  }
}
`;

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 4. FORM COMPONENT — Secure Review Form with Nonce & CSRF
 * ═══════════════════════════════════════════════════════════════════════════
 */

export const SECURE_FORM_COMPONENT = `
'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { CaptchaWidget } from '@/components/ui/CaptchaWidget';
import { SecureClipboardInput } from '@/lib/security/clipboard-protection';

interface ReviewFormProps {
  movieId: string;
  onSuccess?: () => void;
}

export function ReviewForm({ movieId, onSuccess }: ReviewFormProps) {
  const { data: session } = useSession();
  const [nonce, setNonce] = useState<string>('');
  const [csrfToken, setCsrfToken] = useState<string>('');
  const [formData, setFormData] = useState({
    title: '',
    rating: 5,
    content: '',
    spoilers: false,
  });
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // ──── Generate nonce and CSRF on mount ────────────────────────────────
  useEffect(() => {
    const generateTokens = async () => {
      try {
        // Get nonce and CSRF from server
        const res = await fetch('/api/auth/tokens', { method: 'POST' });
        const data = await res.json();
        setNonce(data.nonce);
        setCsrfToken(data.csrfToken);
      } catch (err) {
        setError('Failed to initialize form');
      }
    };

    if (session) {
      generateTokens();
    }
  }, [session]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          movieId,
          ...formData,
          nonce,           // One-time use token
          csrfToken,       // Session-bound token
          captchaToken: (window as any).captchaToken,
          wasPasted: false, // Set true if content came from clipboard
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Submission failed');
      }

      onSuccess?.();
      setFormData({ title: '', rating: 5, content: '', spoilers: false });

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  if (!session) {
    return <p>Please sign in to submit a review.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className=\"space-y-4\">
      {error && (
        <div className=\"text-red-600 bg-red-50 p-3 rounded\">
          {error}
        </div>
      )}

      <div>
        <label className=\"block font-medium mb-1\">Title</label>
        <input
          type=\"text\"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder=\"Review title\"
          required
          minLength={5}
          maxLength={200}
          className=\"w-full border rounded px-3 py-2\"
        />
      </div>

      <div>
        <label className=\"block font-medium mb-1\">Rating</label>
        <select
          value={formData.rating}
          onChange={(e) => setFormData({ ...formData, rating: parseInt(e.target.value) })}
          className=\"w-full border rounded px-3 py-2\"
        >
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <option key={n} value={n}>{n} / 10</option>
          ))}
        </select>
      </div>

      <div>
        <label className=\"block font-medium mb-1\">Review</label>
        <textarea
          value={formData.content}
          onChange={(e) => setFormData({ ...formData, content: e.target.value })}
          placeholder=\"Share your thoughts...\"
          required
          minLength={10}
          maxLength={5000}
          rows={5}
          className=\"w-full border rounded px-3 py-2\"
        />
        <p className=\"text-xs text-gray-500 mt-1\">
          You can paste from clipboard for secure content insertion.
        </p>
      </div>

      <label className=\"flex items-center gap-2\">
        <input
          type=\"checkbox\"
          checked={formData.spoilers}
          onChange={(e) => setFormData({ ...formData, spoilers: e.target.checked })}
        />
        <span>Contains spoilers</span>
      </label>

      <CaptchaWidget />

      <button
        type=\"submit\"
        disabled={loading || !nonce || !csrfToken}
        className=\"w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50\"
      >
        {loading ? 'Submitting...' : 'Submit Review'}
      </button>
    </form>
  );
}
`;

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 5. ENVIRONMENT SETUP
 * ═══════════════════════════════════════════════════════════════════════════
 */

export const ENV_SETUP = `
# .env.local — DO NOT COMMIT THIS FILE
# Copy from .env.example and fill in your values

# Application
NODE_ENV=development
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here-min-32-characters

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/streamfinder

# OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# TMDB API
TMDB_API_KEY=your-tmdb-api-key

# CAPTCHA
CAPTCHA_PROVIDER=hcaptcha
NEXT_PUBLIC_HCAPTCHA_SITE_KEY=your-hcaptcha-site-key
HCAPTCHA_SECRET_KEY=your-hcaptcha-secret-key

# Admin
ADMIN_IP_ALLOWLIST=127.0.0.1
`;

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 6. SETUP INSTRUCTIONS
 * ═══════════════════════════════════════════════════════════════════════════
 */

export const SETUP_GUIDE = `
# SECURITY MODULE SETUP GUIDE

## 1. Installation

All security modules are already created in lib/security/:
- ssti-protection.ts
- redos-protection.ts
- lpdos-protection.ts
- secret-protection.ts
- injection-protection.ts
- clipboard-protection.ts
- replay-protection.ts
- security-headers.ts

## 2. Environment Configuration

1. Copy .env.example to .env.local
2. Fill in all required secrets (see secret-protection.ts for validation)
3. Run validation:
   \`\`\`bash
   npx ts-node scripts/validate-secrets.ts
   \`\`\`

## 3. Pre-Commit Hook Setup

Prevent accidental secret commits:

### Option A: Using husky (recommended)
\`\`\`bash
npm install husky --save-dev
npx husky install
npx husky add .husky/pre-commit "npm run security:hook"
\`\`\`

### Option B: Manual setup
\`\`\`bash
cp scripts/pre-commit-security-hook.mjs .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
\`\`\`

## 4. Middleware Configuration

Update middleware.ts to use security headers (see example above).

## 5. API Routes

Apply security validation to all state-changing routes:
- Use Zod schemas from injection-protection.ts
- Check for suspicious patterns
- Validate nonces and CSRF tokens
- Implement timeouts with lpdos-protection.ts

## 6. Frontend Forms

Use secure form patterns:
- Generate nonce and CSRF on form load
- Use SecureClipboardInput for clipboard handling
- Include CAPTCHA verification

## 7. Testing

Run security tests:
\`\`\`bash
npm run security:scan          # Detect secrets
npm run test:security          # Run security tests
npm run lint                   # Check for issues
\`\`\`

## 8. Monitoring

- Enable error logging (Sentry, etc.)
- Monitor CSP violation reports
- Track replay attack attempts (detector in replay-protection.ts)
- Monitor rate limit violations

## 9. Regular Updates

- Rotate secrets quarterly
- Review CSP headers annually
- Update dependency security patches
- Run security audits
`;

export default {
  MIDDLEWARE_EXAMPLE,
  SECURE_SEARCH_ROUTE,
  SECURE_FORM_ROUTE,
  SECURE_FORM_COMPONENT,
  ENV_SETUP,
  SETUP_GUIDE,
};
