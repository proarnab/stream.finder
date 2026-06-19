// DEPLOYMENT.md
# StreamFinder v3 — Deployment & Security Guide

Complete guide for deploying StreamFinder with full security infrastructure (rate limiting, CAPTCHA, bot detection).

---

## 📋 Pre-Deployment Checklist

### Development Setup (Local)
- [ ] Clone repository
- [ ] `npm install` — installs all dependencies
- [ ] Copy `.env.local.example` → `.env.local`
- [ ] Fill in **REQUIRED** variables:
  - `TMDB_API_KEY` — get from themoviedb.org/settings/api (free)
  - `DATABASE_URL` — PostgreSQL connection string
  - `NEXTAUTH_SECRET` — run `openssl rand -base64 32`
  - `NEXTAUTH_URL` — http://localhost:3000
- [ ] `npx prisma db push` — create database tables
- [ ] `npm run dev` — start development server
- [ ] Test at http://localhost:3000

### Security Setup (Before Production)
- [ ] Set up Upstash Redis (rate limiting) — https://upstash.com/
- [ ] Set up CAPTCHA (pick ONE):
  - hCaptcha — https://www.hcaptcha.com/
  - Cloudflare Turnstile — https://www.cloudflare.com/products/turnstile/
- [ ] Fill in CAPTCHA environment variables
- [ ] Test CAPTCHA widget at /login
- [ ] Test rate limiting with `curl` spam requests
- [ ] Verify bot detection is working (check middleware logs)

### Payment Setup (Optional)
- [ ] Stripe (USD) — https://stripe.com/
  - Create Price objects in Stripe Dashboard
  - Copy price IDs to environment variables
- [ ] Razorpay (INR) — https://razorpay.com/
  - Create subscription plans
  - Copy plan IDs to environment variables

### Analytics & Monitoring (Optional)
- [ ] Vercel Analytics (if deploying to Vercel)
- [ ] Sentry (error tracking)
- [ ] Upstash metrics dashboard for Redis usage

---

## 🚀 Deployment Options

### Option 1: Vercel (Recommended for Next.js)

**Pros:** Instant deployments, auto-scaling, HTTPS, built-in monitoring
**Cost:** Free tier works; $20/month for advanced features

```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Push your code to GitHub
git add .
git commit -m "Initial commit"
git push origin main

# 3. Deploy to Vercel
vercel

# 4. Add environment variables
# Go to: https://vercel.com/dashboard/[project]/settings/environment-variables
# Paste all values from .env.local (EXCEPT public ones which go in code)
```

**Environment variables to add in Vercel:**
- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL` — set to your domain: https://yourdomain.com
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `HCAPTCHA_SECRET_KEY` (or `TURNSTILE_SECRET_KEY`)
- `STRIPE_SECRET_KEY`
- `RAZORPAY_KEY_SECRET`
- All other secrets (not public variables)

```bash
# 5. Test deployment
vercel --prod

# 6. Monitor logs
vercel logs --prod
```

### Option 2: Railway (Full-Stack)

**Pros:** PostgreSQL included, simple dashboard, good free tier
**Cost:** Pay-as-you-go, ~$5–20/month typical

```bash
# 1. Sign up at https://railway.app/
# 2. Create new project → "Deploy from GitHub"
# 3. Select your repository
# 4. Railway auto-detects Next.js
# 5. Add PostgreSQL plugin (Database tab)
# 6. Copy DATABASE_URL from PostgreSQL
# 7. Add other env vars in "Variables" tab
# 8. Deploy button → live in ~2 min
```

**Railway Pro:**
- PostgreSQL is included in the free tier
- Auto-generates DATABASE_URL for you
- Automatic HTTPS on railway.app domain
- Can add custom domain for $5/month

### Option 3: Docker + Self-Hosted

**Pros:** Full control, cheapest for high traffic
**Cost:** $5–50/month depending on VPS provider

```dockerfile
# Dockerfile (create in root)
FROM node:18-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npx prisma generate

EXPOSE 3000
CMD ["npm", "start"]
```

```bash
# Build image
docker build -t streamfinder:latest .

# Run container
docker run -e DATABASE_URL="..." -e NEXTAUTH_SECRET="..." \
  -p 3000:3000 streamfinder:latest
```

**Recommended VPS providers:**
- **DigitalOcean** — $5/month for basic droplet
- **Linode** — $5/month Nanode
- **Hetzner** — €3/month cheapest VPS
- **AWS EC2** — free tier, then ~$5/month

### Option 4: Cloudflare Pages + Workers

**Pros:** Edge deployment, DDoS protection built-in, extremely fast
**Cost:** Free tier generous; $20/month for advanced

```bash
# 1. Install Wrangler
npm install -g wrangler

# 2. Create wrangler.toml
# 3. Deploy via GitHub integration
# 4. Auto-rebuilds on every push
```

---

## 🔧 Post-Deployment Steps

### 1. Verify Everything Works

```bash
# Test homepage
curl https://yourdomain.com/

# Test API
curl https://yourdomain.com/api/search?q=matrix

# Test auth
curl -X POST https://yourdomain.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123456","name":"Test"}'

# Check rate limiting headers
curl -i https://yourdomain.com/api/search
# Should see X-RateLimit-* headers
```

### 2. Test CAPTCHA

1. Visit https://yourdomain.com/login
2. Should see CAPTCHA widget
3. Try logging in without CAPTCHA → should fail
4. Verify CAPTCHA token in request

### 3. Test Rate Limiting

```bash
# Spam search endpoint 35 times (limit is 30/minute)
for i in {1..35}; do
  curl https://yourdomain.com/api/search?q=matrix
  echo "Request $i"
done

# Should see 429 responses after request 30
```

### 4. Set Up Custom Domain

**Vercel:**
1. Project Settings → Domains
2. Add custom domain
3. Update DNS records (provider shows instructions)
4. Auto HTTPS (free)

**Railway:**
1. Project settings → Networking
2. Add custom domain
3. Update DNS CNAME record
4. Auto HTTPS (free)

**Self-hosted:**
1. Point domain DNS to your VPS IP
2. Install Certbot for HTTPS: `sudo apt install certbot`
3. Configure nginx/Apache with SSL
4. Auto-renew certs: `certbot renew --cron`

### 5. Configure Email (For Password Resets)

```bash
# Use Resend (built for Next.js)
npm install resend

# Or SendGrid
npm install @sendgrid/mail

# Set API keys in environment
RESEND_API_KEY=re_xxxx
# or
SENDGRID_API_KEY=SG.xxxx
```

### 6. Monitor in Production

**Upstash Dashboard:**
1. Go to https://console.upstash.com/
2. View Redis metrics
3. Check request volume, latency

**Database Metrics:**
- Vercel Postgres metrics
- Railway PostgreSQL tab
- Self-hosted: `psql` CLI tools

**Application Errors:**
- Set up Sentry for Next.js errors
- Monitor Vercel/Railway logs
- Set up alerts

---

## 🛡️ Security Hardening

### Immediate (Required)

- [ ] Disable debug mode: `NEXTAUTH_DEBUG=false`
- [ ] Set `NODE_ENV=production`
- [ ] Enable HTTPS only
- [ ] Set strong `NEXTAUTH_SECRET` (32+ chars, random)
- [ ] Rotate all API keys after initial setup
- [ ] Enable CAPTCHA (not optional in production)
- [ ] Set up rate limiting via Upstash

### Short-term (1 week)

- [ ] Add security headers (done in middleware.ts)
- [ ] Enable CORS if needed: `Access-Control-Allow-Origin`
- [ ] Set up web application firewall (Cloudflare WAF)
- [ ] Monitor security logs at `/admin/security`
- [ ] Test bot detection with various user-agents
- [ ] Verify rate limit responses (429)

### Ongoing

- [ ] Review security logs weekly
- [ ] Update dependencies: `npm audit`, `npm update`
- [ ] Monitor Upstash usage → add cache if needed
- [ ] Rotate API keys quarterly
- [ ] Review blocked IPs and adjust bot detection
- [ ] Monitor for unusual traffic patterns

---

## 📊 Performance Optimization

### CDN + Caching

```typescript
// next.config.js
export const headers = async () => {
  return [
    {
      source: '/api/:path*',
      headers: [
        { key: 'Cache-Control', value: 'public, max-age=3600' },
      ],
    },
  ];
};
```

### Database Indexes

Already set up in `prisma/schema.prisma`:
- `@@index([userId])` on most tables
- `@@index([createdAt])` for date queries
- `@@index([email])` on User

### Image Optimization

Next.js `Image` component auto-optimizes:
- Lazy loading
- Format conversion (WebP on supported browsers)
- Responsive sizing

### Rate Limiting Strategy

Current tiers (adjust based on your traffic):
```
Search:     30 req/min per IP
Login:      5 req/15min per IP
Register:   3 req/hour per IP
Global:     200 req/min per IP
```

Upgrade if needed:
```bash
RATE_LIMIT_SEARCH=100@1m       # More generous
RATE_LIMIT_LOGIN=10@10m        # More attempts allowed
```

---

## 🐛 Troubleshooting

### "Database connection failed"
```bash
# Check DATABASE_URL is correct
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1"

# If using Vercel PostgreSQL, ensure allowed domains include your deployment
```

### "CAPTCHA not rendering"
```bash
# Check browser console for errors
# Verify CAPTCHA_PROVIDER is set (hcaptcha or turnstile)
# Ensure NEXT_PUBLIC_* keys are in environment

# Local dev (localhost CAPTCHA won't work with IP, use domain)
# Update /etc/hosts: 127.0.0.1 streamfinder.local
# Visit http://streamfinder.local:3000
```

### "Rate limit always exceeded"
```bash
# Check if Upstash is configured
echo $UPSTASH_REDIS_REST_URL

# If not set, will use in-memory (per-instance) limit
# In development: safe to ignore
# In production: MUST set Upstash

# Clear in-memory limit by restarting app
# Or adjust in RATE_LIMITS in lib/ratelimit.ts
```

### "Bot detection blocks legitimate users"
```bash
# Set permissive mode temporarily
BOT_DETECTION_MODE=permissive

# Check logs at /admin/security
# Adjust confidence threshold in lib/botdetection.ts
# Whitelist specific user-agents if needed
```

### "Out of memory / crashes"
```bash
# Check Upstash usage (may be rate limit keys)
# Reduce in-memory event buffer in lib/securitylog.ts
# Flush logs more frequently

# Monitor: https://console.upstash.com/redis
```

---

## 📈 Scaling for High Traffic

### Tier 1: 1K–10K users
- Current setup handles this fine
- Monitor database query times
- Increase Upstash limits if needed

### Tier 2: 10K–100K users
- Set up database read replicas
- Enable Vercel Edge Caching
- Increase rate limits

### Tier 3: 100K+ users
- Database sharding/partitioning
- Multi-region deployments
- Custom CDN (Fastly, Akamai)
- Dedicated API rate limiter (Kong, Traefik)

---

## 🎯 Next Milestones

After deployment:
1. **Monitor** — 1 week of live traffic
2. **Optimize** — based on metrics
3. **Scale** — add regions if needed
4. **Monetize** — enable AdSense if eligible
5. **Enhance** — add features based on user feedback

---

## 📞 Support Resources

- **Vercel:** https://vercel.com/docs
- **Next.js:** https://nextjs.org/docs
- **Prisma:** https://www.prisma.io/docs/
- **Upstash:** https://upstash.com/docs/
- **hCaptcha:** https://docs.hcaptcha.com/
- **Turnstile:** https://developers.cloudflare.com/turnstile/

---

**Last Updated:** 2026-06-15
**Version:** 3.0.0
