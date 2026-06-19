// middleware.ts — HARDENED StreamFinder v3
import { NextResponse, NextRequest } from 'next/server';
import { rateLimit, getClientIP, RATE_LIMITS, tooManyRequestsResponse } from '@/lib/ratelimit';
import { detectBot, isIPBlocked, botDetectionHeaders } from '@/lib/botdetection';
import { getToken } from 'next-auth/jwt';

const EXCLUDED_PATHS = [
  /^\/robots\.txt$/, /^\/sitemap\.xml$/, /^\/manifest\.json$/,
  /^\/_next\//, /^\/public\//, /^\/api\/health$/, /^\/favicon\.ico$/, /^\/icons\//,
];

const STRICT_PATHS: Record<string, typeof RATE_LIMITS[keyof typeof RATE_LIMITS]> = {
  '/api/auth/login':              RATE_LIMITS.LOGIN,
  '/api/auth/register':           RATE_LIMITS.REGISTER,
  '/api/auth/password-reset':     RATE_LIMITS.PASSWORD_RESET,
  '/api/reviews':                 RATE_LIMITS.REVIEW_SUBMIT,
  '/api/billing/stripe/checkout': RATE_LIMITS.CHECKOUT,
  '/api/billing/razorpay/create': RATE_LIMITS.CHECKOUT,
};

const SEARCH_PATHS: Record<string, typeof RATE_LIMITS[keyof typeof RATE_LIMITS]> = {
  '/api/search':          RATE_LIMITS.SEARCH,
  '/api/search/semantic': RATE_LIMITS.SEARCH_SEMANTIC,
};

const ADMIN_PATHS = ['/admin', '/api/admin'];
const ADMIN_IP_ALLOWLIST = (process.env.ADMIN_IP_ALLOWLIST ?? '').split(',').map(s => s.trim()).filter(Boolean);

const ATTACK_PROBES = [
  /\.(php|asp|aspx|jsp|cgi|pl|py|rb|sh|bash|cmd|bat|exe|sql|bak|env|git|svn)$/i,
  /\/(wp-admin|wp-login|phpmyadmin|phpinfo|xmlrpc|\.env|\.git|admin\.php)/i,
  /(<script|javascript:|onerror=|onload=|alert\(|document\.cookie)/i,
  /(union\s+select|drop\s+table|insert\s+into|delete\s+from|exec\s*\()/i,
  /(\.\.\/)|(\.\.\\)/,
];

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const ip = getClientIP(req);
  const requestId = crypto.randomUUID();
  const response = NextResponse.next();
  response.headers.set('X-Request-ID', requestId);

  if (isIPBlocked(ip)) return new NextResponse('Access denied', { status: 403, headers: { 'X-Request-ID': requestId } });

  if (EXCLUDED_PATHS.some(p => p.test(pathname))) {
    response.headers.set('X-Request-ID', requestId);
    return response;
  }

  const fullUrl = pathname + req.nextUrl.search;
  for (const pattern of ATTACK_PROBES) {
    if (pattern.test(fullUrl)) {
      console.warn(`[SECURITY] Attack probe blocked from ${ip}: ${pathname}`);
      return new NextResponse('Not found', { status: 404, headers: { 'X-Request-ID': requestId } });
    }
  }

  if (ADMIN_PATHS.some(p => pathname.startsWith(p))) {
    if (ADMIN_IP_ALLOWLIST.length > 0 && !ADMIN_IP_ALLOWLIST.includes(ip)) {
      return new NextResponse('Forbidden', { status: 403, headers: { 'X-Request-ID': requestId } });
    }
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token || !['ADMIN', 'MODERATOR'].includes(String(token.role ?? ''))) {
      return new NextResponse('Not found', { status: 404, headers: { 'X-Request-ID': requestId } });
    }
  }

  const botResult = detectBot(req);
  const botHdrs = botDetectionHeaders(botResult);

  if (botResult.isBot && botResult.confidence > 0.8) {
    const sensitiveEndpoints = Object.keys(STRICT_PATHS);
    if (sensitiveEndpoints.some(p => pathname.startsWith(p))) {
      return new NextResponse(JSON.stringify({ error: 'Automated access not permitted' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...botHdrs, 'X-Request-ID': requestId },
      });
    }
  }

  if (['POST','PUT','DELETE','PATCH'].includes(req.method) && pathname.startsWith('/api/') &&
      !pathname.startsWith('/api/auth/') && !pathname.startsWith('/api/billing/stripe/webhook')) {
    const origin = req.headers.get('origin');
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? '';
    const csrfHeader = req.headers.get('x-requested-with');
    const originOk = !origin || !siteUrl || origin === siteUrl || origin === 'null';
    const headerOk = csrfHeader === 'XMLHttpRequest' || csrfHeader === 'fetch';
    if (!originOk && !headerOk) {
      return new NextResponse(JSON.stringify({ error: 'CSRF validation failed' }), {
        status: 403, headers: { 'Content-Type': 'application/json', 'X-Request-ID': requestId },
      });
    }
  }

  let config = RATE_LIMITS.GLOBAL;
  for (const [path, limit] of Object.entries(STRICT_PATHS)) {
    if (pathname.startsWith(path)) { config = limit; break; }
  }
  if (config === RATE_LIMITS.GLOBAL) {
    for (const [path, limit] of Object.entries(SEARCH_PATHS)) {
      if (pathname.startsWith(path)) { config = limit; break; }
    }
  }

  const rl = await rateLimit(req, config);
  response.headers.set('X-RateLimit-Limit', String(rl.limit));
  response.headers.set('X-RateLimit-Remaining', String(rl.remaining));
  response.headers.set('X-RateLimit-Reset', String(rl.reset));
  Object.entries(botHdrs).forEach(([k, v]) => response.headers.set(k, v));

  if (!rl.success) {
    const err = tooManyRequestsResponse(rl);
    err.headers.set('X-Request-ID', requestId);
    return err;
  }

  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
  response.headers.set('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://js.hcaptcha.com https://challenges.cloudflare.com https://pagead2.googlesyndication.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https:",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://api.themoviedb.org https://hcaptcha.com https://challenges.cloudflare.com",
    "frame-src https://hcaptcha.com https://challenges.cloudflare.com",
    "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'", "upgrade-insecure-requests",
  ].join('; '));
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }
  response.headers.set('X-Request-ID', requestId);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'],
};
