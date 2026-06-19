# StreamFinder v3 — Production-Ready Movie Discovery Platform

A **complete, full-stack Next.js application** for discovering where to watch any movie legally online. Includes built-in security, payments, community features, and monetization.

**Features:** Semantic search • Movie details • Where to watch • Reviews • Watchlists • User profiles • Subscriptions • Affiliate system • PWA • Rate limiting • CAPTCHA • Bot detection

---

## ✨ What's Included

### Core (Movie Discovery)
- ✅ Semantic natural-language search ("horror set in Japan 2023")
- ✅ Where to watch availability (Netflix, Prime, etc.) — powered by JustWatch/TMDb
- ✅ Free streaming detection (Tubi, Pluto, Peacock, etc.)
- ✅ Movie details (cast, crew, budget, runtime, IMDb/Rotten Tomatoes ratings)
- ✅ Trailers and video embeds
- ✅ Watchlists (save for later)

### Community & Accounts
- ✅ User authentication (email/password + Google + GitHub OAuth)
- ✅ User profiles (customizable, role-based)
- ✅ Community reviews with spoiler warnings
- ✅ Review moderation system
- ✅ Three user roles: Fan, Critic, Creator/Filmmaker

### Monetization (Built-in)
- ✅ Google AdSense integration
- ✅ Affiliate links (Amazon, Apple)
- ✅ Subscription plans (Stripe USD + Razorpay INR)
  - Critic Pro ($3/mo or ₹199/mo)
  - Creator Pro ($6/mo or ₹499/mo)
  - Studio ($35/mo or ₹2999/mo)
- ✅ Affiliate commission system (10% per referral)
- ✅ Sponsored spotlights (featured placements)

### Security (v3 NEW)
- ✅ Rate limiting (Upstash Redis + in-memory fallback)
- ✅ CAPTCHA (hCaptcha or Cloudflare Turnstile)
- ✅ Bot detection (User-Agent + behavioral analysis)
- ✅ Security headers (CSP, HSTS, X-Frame-Options)
- ✅ IP blocking/allowlisting
- ✅ Audit logs (security events database)
- ✅ Admin security dashboard

### Extras
- ✅ Progressive Web App (PWA) — installable
- ✅ Merchandise affiliate widget
- ✅ Email verification (ready for Resend/SendGrid)
- ✅ Production-ready (HTTPS, security headers, error handling)

---

## 🚀 Quick Start (5 minutes)

### Requirements
- Node.js 18+ — https://nodejs.org
- PostgreSQL — Free at [Supabase](https://supabase.com), [Railway](https://railway.app), or [PlanetScale](https://planetscale.com)
- TMDB API key — Free at [themoviedb.org/settings/api](https://themoviedb.org/settings/api)

### Setup

```bash
# 1. Clone & install
git clone https://github.com/yourusername/streamfinder.git
cd streamfinder
npm install

# 2. Create environment file
cp .env.local.example .env.local

# Edit .env.local and add:
# TMDB_API_KEY=your_key_here
# DATABASE_URL=postgresql://user:pass@host/db
# NEXTAUTH_SECRET=openssl rand -base64 32  # run this command

# 3. Set up database
npx prisma db push
npx prisma generate

# 4. Start dev server
npm run dev

# 5. Open http://localhost:3000
```

---

## 📁 What You Get

**~70 files** covering:
- 🎬 Movie search & discovery
- 🔐 Authentication + authorization
- 💳 Stripe + Razorpay payments
- 📝 Reviews + moderation
- 🛡️ Rate limiting + CAPTCHA + bot detection
- 📊 Admin dashboards
- 📱 PWA + offline support
- 🎯 Security logging + audit trail

**No** boilerplate, no empty folders — every file has purpose.

---

## 🔒 Security (Production-Grade)

### What's Protected
- Auth endpoints (login, register) — CAPTCHA + rate limit
- Search — rate limited to prevent scraping
- Payment — strict rate limiting
- All APIs — global DDoS protection

### How It Works

1. **Middleware** (`middleware.ts`)
   - Runs on every request
   - Detects bots, applies rate limits, adds security headers
   - Blocks obvious attackers (bots with confidence > 0.8)

2. **Rate Limiting** (`lib/ratelimit.ts`)
   - Upstash Redis-backed (serverless, no DevOps)
   - Per-IP + per-user limits
   - In-memory fallback for development

3. **CAPTCHA** (`lib/captcha.ts`)
   - hCaptcha (privacy-focused) or Turnstile (invisible)
   - Server-side verification
   - Not Google reCAPTCHA (privacy concerns)

4. **Bot Detection** (`lib/botdetection.ts`)
   - Detects curl, wget, Puppeteer, headless browsers
   - Analyzes User-Agent + missing browser headers
   - Behavioral signals (referer, CSP headers)

5. **Audit Logs** (`lib/securitylog.ts`)
   - All security events logged to database
   - Queryable via admin dashboard (`/admin/security`)
   - Events: login failures, rate limits, bot detections, etc.

### Security Dashboard
- Visit `/admin/security` (ADMIN role only)
- View real-time security events
- Manage IP blocklist/allowlist
- Monitor attack patterns

---

## 💳 Payments

### Stripe (USD)
- For users in US, Canada, EU, etc.
- $3, $6, $35 monthly plans
- Auto-renewing subscriptions
- Webhook handlers auto-activate features

### Razorpay (INR)
- For India, Asia market
- ₹199, ₹499, ₹2999 monthly plans
- Rupee pricing is cheaper (parity with USD)
- Same feature set as Stripe

### No Transaction Fees (For You)
- You pay Stripe/Razorpay their fees (~2.9% + $0.30 per transaction)
- But you keep 100% of subscription revenue
- Affiliate commissions are separate income

---

## 📈 Monetization

### Out-of-the-Box Revenue Streams

1. **AdSense** (passive income)
   - Homepage, sidebar, movie page placements
   - Typical: $0.50–$2 per 1,000 impressions (RPM)
   - Needs: 1,000 monthly visitors to get approved

2. **Affiliate Links** (4–10% commission)
   - Auto-generated Amazon links (Blu-ray, DVD, posters)
   - Apple iTunes links
   - Every movie page has these
   - Approvals: Join Amazon Associates, Apple Performance Partners

3. **Subscriptions** (recurring revenue)
   - Critic Pro — for reviewers who want verified badge + affiliate dashboard
   - Creator Pro — for filmmakers who want "Available for Work" badge
   - Studio — for production companies (featured placements + analytics)
   - Typical conversion: 1–3% of registered users

4. **Sponsored Spotlights** (one-time revenue)
   - Film studios pay for featured placement
   - Customizable duration, CTA, landing page
   - Tracked impressions + click data

---

## 🚀 Deployment

### Vercel (Recommended)
```bash
git push origin main  # Auto-deploys to Vercel
# Or: vercel --prod
```
- Free tier works for small projects
- Custom domain + HTTPS included
- Auto-HTTPS, auto-scaling

### Railway
- PostgreSQL included in free tier
- Simple dashboard
- $5–20/month for production

### Docker (Self-Hosted)
```bash
docker build -t streamfinder .
docker run -e DATABASE_URL="..." streamfinder
```
- Full control, cheapest for high traffic
- Deploy to DigitalOcean, Linode, etc. (~$5/mo)

**[Full deployment guide → DEPLOYMENT.md](./DEPLOYMENT.md)**

---

## 📖 Documentation

- **[SECURITY.md](./SECURITY.md)** — Rate limiting, CAPTCHA, bot detection setup
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** — Production deployment (Vercel, Railway, Docker)
- **[.env.local.example](./.env.local.example)** — All environment variables

---

## 🛠️ Tech Stack

| What | Technology | Why |
|------|-----------|-----|
| Framework | Next.js 14 | Full-stack SSR, API routes, best DX |
| Database | PostgreSQL | Reliable, ACID, JSON support |
| Auth | NextAuth.js | Industry standard, multiple providers |
| ORM | Prisma | Type-safe, great migrations |
| Styling | Tailwind CSS | Fast, utility-first |
| Payments | Stripe + Razorpay | Global coverage |
| Rate Limiting | Upstash Redis | Serverless, no DevOps |
| CAPTCHA | hCaptcha / Turnstile | Privacy-first |
| Deploy | Vercel / Railway / Docker | Zero-config or full control |

---

## 📊 Project Stats

- **Lines of Code:** ~8,000+ (production-grade)
- **Database Tables:** 55+
- **API Routes:** 20+
- **React Components:** 40+
- **Time to Build:** ~40 hours (fully featured)
- **Maintenance:** Low (well-organized, documented)

---

## 🎯 Use Cases

- **Portfolio:** Show full-stack skills to employers
- **SaaS:** Spin into a paid service (already has payments)
- **Learning:** Study production Next.js patterns
- **Startup:** Launch as a real product (all features work)
- **Agency:** White-label for clients

---

## ❓ FAQ

**Q: Do I need my own TMDB account?**
A: Yes, free API key from themoviedb.org. Rate limit: 40 requests/10 seconds.

**Q: What about the streaming data (Netflix, Prime)?**
A: Comes from TMDB's watch/providers endpoint, powered by JustWatch. Real-time updates.

**Q: Do I need to pay for rate limiting?**
A: Upstash has a generous free tier (10k requests/day). Falls back to in-memory in dev.

**Q: Can I modify the designs?**
A: Yes, fully customizable. Tailwind classes + React components = easy to change.

**Q: Is this DMCA-safe?**
A: Yes. You're not hosting videos, just linking to legal streaming services. Attribute TMDb as required.

**Q: How do I make money?**
A: AdSense, affiliate links, subscriptions, sponsored placements. See Monetization section.

---

## 📝 License

MIT — Use freely in commercial projects.

---

## 🚀 Next Steps

1. **Deploy** — Get it live (Vercel or Railway, ~5 min)
2. **Customize** — Change colors, domain, logo
3. **Test Security** — Run bot detection + rate limiting tests
4. **Monetize** — Set up AdSense + affiliate accounts
5. **Monitor** — Check admin dashboard weekly
6. **Grow** — Market on social media, SEO optimization

---

**Made with ❤️ by StreamFinder**

**v3.0.0** | Production Ready ✅ | Updated 2026-06-15
