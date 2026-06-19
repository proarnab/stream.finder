// SECURITY.md
# StreamFinder Security Guide

Complete documentation for rate limiting, CAPTCHA, bot detection, and DDoS protection.

---

## 🔒 Overview

StreamFinder v3 includes **production-grade security** out of the box:

- **Rate Limiting** — Redis-backed (Upstash) or in-memory fallback
- **CAPTCHA** — hCaptcha or Cloudflare Turnstile (privacy-first)
- **Bot Detection** — User-Agent + behavioral analysis
- **Security Headers** — CSP, HSTS, X-Frame-Options, etc.
- **IP Blocking** — Allowlist/blocklist functionality
- **Middleware** — Global protection on all routes

---

## 🚀 Quick Setup (5 minutes)

### 1. Enable Upstash Redis (Rate Limiting)

```bash
# 1. Sign up at https://upstash.com/ (free tier: 10k req/day)
# 2. Create a Redis database
# 3. Copy REST API credentials to .env.local:

UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token_here
```

### 2. Add CAPTCHA (Pick ONE)

#### Option A: hCaptcha (Recommended)
```bash
# 1. Sign up at https://www.hcaptcha.com/
# 2. Create a website account
# 3. Copy keys to .env.local:

CAPTCHA_PROVIDER=hcaptcha
NEXT_PUBLIC_HCAPTCHA_SITE_KEY=your_site_key
HCAPTCHA_SECRET_KEY=your_secret_key
```

#### Option B: Cloudflare Turnstile (Invisible, Completely Free)
```bash
# 1. Go to https://dash.cloudflare.com/
# 2. Account Settings → Turnstile → Add site
# 3. Copy keys to .env.local:

CAPTCHA_PROVIDER=turnstile
NEXT_PUBLIC_TURNSTILE_SITE_KEY=your_site_key
TURNSTILE_SECRET_KEY=your_secret_key
```

### 3. Test It

```bash
npm install  # installs @upstash/ratelimit, @upstash/redis, hcaptcha
npm run dev
```

Visit `/login` — you should see the CAPTCHA widget. Try submitting the form 5 times rapidly → should get rate limited.

---

## 📊 Rate Limiting Tiers

All configured in `lib/ratelimit.ts` and applied globally via `middleware.ts`:

| Endpoint | Limit | Window | Purpose |
|----------|-------|--------|---------|
| `/api/search` | 30 req | 1 min | Prevent scraping |
| `/api/search/semantic` | 20 req | 1 min | Complex query protection |
| `/api/auth/login` | 5 req | 15 min | Brute force prevention |
| `/api/auth/register` | 3 req | 1 hour | Account creation spam |
| `/api/reviews` | 5 req | 1 hour | Review spam |
| `/api/billing/stripe/checkout` | 5 req | 1 hour | Payment spam |
| Global (all IPs) | 200 req | 1 min | Catch-all DDoS protection |

### Customizing Limits

Edit `RATE_LIMITS` in `lib/ratelimit.ts`:

```typescript
export const RATE_LIMITS = {
  SEARCH: { requests: 30, window: '1 m', prefix: 'rl:search' },
  // Adjust requests and window as needed
};
```

Or via environment variables:

```bash
RATE_LIMIT_LOGIN=5@15m      # 5 requests per 15 minutes
RATE_LIMIT_REGISTER=3@1h    # 3 requests per 1 hour
RATE_LIMIT_SEARCH=30@1m     # etc.
```

---

## 🤖 Bot Detection

Automatically detects:
- Scrapers (curl, wget, Python requests, Scrapy)
- Headless browsers (Puppeteer, Playwright, PhantomJS)
- Security scanners (Nikto, Nmap, SQLmap)
- Suspicious user-agents

### How It Works

1. **User-Agent Analysis** — patterns in the UA string (0.0–1.0 confidence)
2. **Header Analysis** — missing browser headers (accept, accept-language)
3. **Behavior Signals** — missing referer, suspicious header combinations

Bots with **confidence > 0.6** are blocked from sensitive endpoints (login, register, checkout).

### Adjusting Sensitivity

Edit `BOT_DETECTION_MODE` in `.env.local`:

```bash
# permissive — warn but allow (default)
BOT_DETECTION_MODE=permissive

# strict — block bots with score > 0.6
BOT_DETECTION_MODE=strict
```

In code (`lib/botdetection.ts`):

```typescript
const botResult = detectBot(req);
if (botResult.isBot && botResult.confidence > 0.8) {
  return new NextResponse('Bot detected', { status: 403 });
}
```

---

## 🛡️ Security Headers (Automatic)

All applied via middleware. No configuration needed:

| Header | Purpose |
|--------|---------|
| `X-Frame-Options: SAMEORIGIN` | Prevent clickjacking |
| `X-Content-Type-Options: nosniff` | Prevent MIME sniffing |
| `X-XSS-Protection: 1; mode=block` | XSS protection |
| `Content-Security-Policy` | Restrict scripts/resources |
| `Referrer-Policy: strict-origin-when-cross-origin` | Privacy |
| `Permissions-Policy` | Disable camera, microphone, geolocation |
| `Strict-Transport-Security` | HTTPS only (production) |

### Customizing CSP

Edit `middleware.ts`:

```typescript
response.headers.set('Content-Security-Policy',
  "default-src 'self'; script-src 'self' https://trusted-cdn.com"
);
```

---

## 🔒 IP Allowlist / Blocklist

### Block an IP

```typescript
import { blockIP } from '@/lib/botdetection';

// In your admin panel or API route:
blockIP('203.0.113.45');
```

### Unblock an IP

```typescript
import { unblockIP } from '@/lib/botdetection';

unblockIP('203.0.113.45');
```

### Check if IP is Blocked

```typescript
import { isIPBlocked } from '@/lib/botdetection';

if (isIPBlocked(clientIP)) {
  return new NextResponse('Access denied', { status: 403 });
}
```

---

## 📝 Protected API Example

Here's how to add rate limiting + CAPTCHA to any API route:

```typescript
// app/api/my-endpoint/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, tooManyRequestsResponse } from '@/lib/ratelimit';
import { verifyCaptcha, extractCaptchaToken } from '@/lib/captcha';
import { RATE_LIMITS } from '@/lib/ratelimit';

export async function POST(req: NextRequest) {
  // 1. Rate limit
  const rateLimitResult = await rateLimit(req, RATE_LIMITS.REVIEW_SUBMIT);
  if (!rateLimitResult.success) {
    return tooManyRequestsResponse(rateLimitResult);
  }

  // 2. CAPTCHA verification
  const captchaToken = await extractCaptchaToken(req);
  const captchaResult = await verifyCaptcha(captchaToken);
  if (!captchaResult.success) {
    return NextResponse.json({ error: captchaResult.error }, { status: 400 });
  }

  // 3. Process request
  const body = await req.json();
  // ... your logic here ...
  return NextResponse.json({ ok: true });
}
```

---

## 🧪 Testing & Monitoring

### Test Rate Limiting

```bash
# Trigger the limit (will succeed 5 times, then fail)
for i in {1..10}; do curl http://localhost:3000/api/auth/login; done

# Watch the X-RateLimit-* headers
curl -i http://localhost:3000/api/auth/login
# X-RateLimit-Limit: 5
# X-RateLimit-Remaining: 4
# X-RateLimit-Reset: 1234567890
```

### Test CAPTCHA

1. Visit http://localhost:3000/login
2. You should see a CAPTCHA widget
3. Try logging in without checking the box — should fail
4. Check the CAPTCHA → should be able to submit

### Monitor in Production

Upstash provides a dashboard:
1. Go to https://console.upstash.com/
2. Click your Redis database
3. View request graphs, connected clients, memory usage

---

## 🚨 Common Issues & Fixes

### "CAPTCHA token missing"
- Browser didn't render widget properly
- Check browser console for errors
- Ensure `NEXT_PUBLIC_HCAPTCHA_SITE_KEY` or `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set

### "Rate limit exceeded" on every request
- You've hit the limit for this IP
- Wait until the `Retry-After` header time passes (in seconds)
- In development: restart the server to reset in-memory store

### "UPSTASH_REDIS_REST_URL not set"
- Rate limiting falls back to in-memory (slower, not distributed)
- For production: set up Upstash Redis
- In development: safe to ignore, works fine

### "Bot detected" blocks legitimate users
- May be overly strict with certain ISPs or corporate networks
- Set `BOT_DETECTION_MODE=permissive` to warn only
- Check `/app/middleware.ts` for the detection logic

---

## 📈 Production Checklist

Before going live:

- [ ] Set `CAPTCHA_PROVIDER` and keys in production env
- [ ] Set `UPSTASH_REDIS_REST_URL` and token
- [ ] Test rate limiting with `curl` rapid requests
- [ ] Verify CAPTCHA appears on login/register
- [ ] Check security headers in browser DevTools
- [ ] Enable `NODE_ENV=production`
- [ ] Disable `NEXTAUTH_DEBUG=false`
- [ ] Set `NEXT_PUBLIC_SITE_URL` to your domain
- [ ] Test on actual domain (localhost CAPTCHA won't work from IP)

---

## 🔐 Default Credentials Policy

Never commit `.env.local` to git:

```bash
# .gitignore
.env.local
.env.*.local
```

For CI/CD, set environment variables in your deployment platform:
- **Vercel**: Project Settings → Environment Variables
- **Railway**: Variables tab
- **Docker**: `docker run -e UPSTASH_REDIS_REST_URL=...`

---

## 📞 Support

- **Upstash Issues**: https://upstash.com/docs/
- **hCaptcha Issues**: https://docs.hcaptcha.com/
- **Turnstile Issues**: https://developers.cloudflare.com/turnstile/
- **Rate Limiting**: Check `lib/ratelimit.ts` comments
- **Bot Detection**: Check `lib/botdetection.ts` comments

---

## 🎯 Next Steps

1. **IP Reputation API** — integrate with AbuseIPDB for real-time IP scoring
2. **CORS Protection** — restrict API access to your domain only
3. **API Key Rate Limiting** — per-API-key limits for third-party integrations
4. **Logging & Alerts** — log all security events to Slack/PagerDuty
5. **WAF Integration** — use Cloudflare WAF for advanced DDoS protection
