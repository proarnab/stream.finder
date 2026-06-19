# 🚀 Step-by-Step Deployment Guide

**Application:** StreamFinder v3  
**Stack:** Next.js 14 + Prisma + PostgreSQL + NextAuth  
**Environment:** Production  
**Last Updated:** June 19, 2026

---

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Environment Setup](#environment-setup)
3. [Database Configuration](#database-configuration)
4. [Security Configuration](#security-configuration)
5. [Build & Testing](#build--testing)
6. [Production Deployment](#production-deployment)
7. [Post-Deployment Verification](#post-deployment-verification)
8. [Monitoring & Alerts](#monitoring--alerts)
9. [Rollback Procedure](#rollback-procedure)
10. [Troubleshooting](#troubleshooting)

---

## Pre-Deployment Checklist

### ✅ Code Review & Testing

- [ ] All code reviewed by security team
- [ ] All tests passing locally (`npm test`)
- [ ] No console errors or warnings
- [ ] TypeScript compilation successful (`npm run build`)
- [ ] All security modules imported and tested
- [ ] Pre-commit hooks verified working
- [ ] No hardcoded secrets or API keys
- [ ] Git history clean (no sensitive commits)
- [ ] All dependencies up-to-date (`npm audit` passes)

**Run:**
```bash
npm run build
npm test
npm run lint
npm audit
```

### ✅ Infrastructure Requirements

- [ ] PostgreSQL database provisioned (v13+)
- [ ] Redis instance running (rate limiting, sessions)
- [ ] Domain name configured and DNS updated
- [ ] SSL/TLS certificate obtained (Let's Encrypt recommended)
- [ ] CDN configured (Cloudflare/AWS CloudFront)
- [ ] Email service configured (SendGrid/AWS SES)
- [ ] Payment gateways tested (Stripe & Razorpay)
- [ ] CAPTCHA service configured (hCaptcha/Turnstile)
- [ ] Server capacity sufficient (minimum: 2GB RAM, 2 CPU cores)

### ✅ Team & Documentation

- [ ] Deployment runbook reviewed by team
- [ ] Incident response plan documented
- [ ] On-call rotation established
- [ ] Communication channels ready (Slack alerts)
- [ ] Rollback procedure tested
- [ ] Database backup tested and verified
- [ ] Access controls documented (who has prod access)

---

## Environment Setup

### Step 1: Clone Repository and Install Dependencies

```bash
# Clone repo (if not already done)
cd /path/to/deployment
git clone <repository-url> streamfinder-v3
cd streamfinder-v3

# Install dependencies
npm install

# Verify installation
npm list next prisma next-auth
```

**Expected Output:**
```
├── next@14.2.0
├── prisma@5.14.0
├── next-auth@4.24.7
└── ... (other deps)
```

### Step 2: Configure Environment Variables

Create `.env.production` file with all required variables:

```bash
# Copy template
cp .env.local .env.production

# Edit with production values
nano .env.production
```

**Required Variables:**

```env
# ============ DATABASE ============
DATABASE_URL="postgresql://user:password@prod-db.example.com:5432/streamfinder?schema=public"
DATABASE_POOL_MIN=5
DATABASE_POOL_MAX=20

# ============ NEXTAUTH ============
NEXTAUTH_URL="https://streamfinder.com"
NEXTAUTH_SECRET="$(openssl rand -base64 32)"  # Generate new secure value

# Google OAuth
GOOGLE_CLIENT_ID="xxx.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="xxxxxxxxxxxx"

# GitHub OAuth
GITHUB_ID="xxxxxxxxxxxx"
GITHUB_SECRET="xxxxxxxxxxxx"

# ============ SECURITY ============
JWT_SECRET="$(openssl rand -base64 32)"
JWT_EXPIRATION_HOURS=24
NONCE_EXPIRY_SECONDS=900
CSRF_TOKEN_EXPIRY_SECONDS=3600

# ============ RATE LIMITING ============
UPSTASH_REDIS_REST_URL="https://xxx.upstash.io"
UPSTASH_REDIS_REST_TOKEN="xxxxxxxxxxxxx"
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS_PER_MINUTE=60

# ============ PAYMENT ============
STRIPE_SECRET_KEY="sk_live_xxxxxxxxxxxx"
STRIPE_PUBLISHABLE_KEY="pk_live_xxxxxxxxxxxx"
STRIPE_WEBHOOK_SECRET="whsec_xxxxxxxxxxxx"

RAZORPAY_KEY_ID="xxxxxxxxxxxx"
RAZORPAY_KEY_SECRET="xxxxxxxxxxxx"

# ============ CAPTCHA ============
HCAPTCHA_SECRET="xxxxxxxxxxxx"
TURNSTILE_SECRET="xxxxxxxxxxxx"

# ============ TMDB ============
TMDB_API_KEY="xxxxxxxxxxxx"

# ============ EMAIL ============
SENDGRID_API_KEY="SG.xxxxxxxxxxxx"
EMAIL_FROM="noreply@streamfinder.com"

# ============ LOGGING & MONITORING ============
SENTRY_DSN="https://xxxxxxxxxxxx@xxxxx.ingest.sentry.io/xxxxx"
LOG_LEVEL="info"
ENVIRONMENT="production"

# ============ SECURITY HEADERS ============
CSP_REPORT_URI="https://streamfinder.com/api/csp-report"
HSTS_MAX_AGE=31536000  # 1 year
```

### Step 3: Validate Environment Variables

```bash
# Check all required variables are set
node -e "
const required = [
  'DATABASE_URL',
  'NEXTAUTH_URL',
  'NEXTAUTH_SECRET',
  'JWT_SECRET',
  'STRIPE_SECRET_KEY',
  'RAZORPAY_KEY_ID'
];
const missing = required.filter(v => !process.env[v]);
if (missing.length) {
  console.error('❌ Missing:', missing.join(', '));
  process.exit(1);
} else {
  console.log('✅ All required variables set');
}
"
```

---

## Database Configuration

### Step 1: Database Connection Test

```bash
# Test connection (from project root)
npx prisma db pull

# Should download existing schema without errors
```

### Step 2: Run Migrations

```bash
# View pending migrations
npx prisma migrate status

# Apply all pending migrations to production
npx prisma migrate deploy

# Verify schema is correct
npx prisma db pull --force  # Don't commit this, just verify
```

### Step 3: Seed Initial Data (if needed)

```bash
# Create seed script if not exists
# scripts/seed.ts

# Run seed
npx prisma db seed
```

### Step 4: Database Backup Before Deploy

```bash
# PostgreSQL backup
pg_dump -h prod-db.example.com -U dbuser -d streamfinder > backup-$(date +%Y%m%d-%H%M%S).sql

# Verify backup
ls -lh backup-*.sql
```

### Step 5: Setup Connection Pooling

**For Production (Recommended: PgBouncer):**

```ini
# /etc/pgbouncer/pgbouncer.ini
[databases]
streamfinder = host=primary-db.example.com port=5432 dbname=streamfinder user=dbuser

[pgbouncer]
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 20
min_pool_size = 5
reserve_pool_size = 5
server_lifetime = 3600
server_idle_timeout = 600

[users]
dbuser = "password"
```

**Update .env.production:**
```env
DATABASE_URL="postgresql://dbuser:password@pgbouncer.local:6432/streamfinder"
```

---

## Security Configuration

### Step 1: Setup Pre-Commit Hook

```bash
# Copy pre-commit hook
cp scripts/pre-commit-security-hook.mjs .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit

# Test it
git add .env.production
git commit -m "test"  # Should pass (no secrets exposed)
```

### Step 2: Configure Security Headers

**Verify in next.config.js:**

```typescript
// next.config.js
const { getSecurityHeadersConfig } = require('./lib/security/security-headers');

const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: getSecurityHeadersConfig(),
      },
    ];
  },
};

module.exports = nextConfig;
```

### Step 3: Setup HSTS Preload

```bash
# Generate HSTS header (already in security-headers.ts)
# After deployment, submit domain to HSTS preload list:
# https://hstspreload.org/

# In production, header will be:
# Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

### Step 4: Configure CSP Report Endpoint

Create `app/api/csp-report/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const report = await req.json();
    
    // Log CSP violations
    console.warn('CSP Violation:', {
      blockedUri: report['blocked-uri'],
      violatedDirective: report['violated-directive'],
      originalPolicy: report['original-policy'],
      sourceFile: report['source-file'],
      lineNumber: report['line-number'],
      timestamp: new Date().toISOString(),
    });

    // Send to monitoring service (e.g., Sentry)
    if (process.env.SENTRY_DSN) {
      // Integrate with Sentry/monitoring tool
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('CSP report error:', error);
    return NextResponse.json(
      { error: 'Failed to log CSP violation' },
      { status: 400 }
    );
  }
}
```

### Step 5: Setup Monitoring & Logging

```bash
# Install Sentry (if not already)
npm install @sentry/nextjs

# Initialize Sentry (auto-generated)
npx @sentry/wizard@latest -i nextjs
```

**Update next.config.js:**

```typescript
const withSentryConfig = require("@sentry/nextjs/withSentryConfig");

const nextConfig = {
  // ... existing config
};

module.exports = withSentryConfig(nextConfig, {
  org: "your-sentry-org",
  project: "streamfinder",
  silent: false,
});
```

---

## Build & Testing

### Step 1: Build Application

```bash
# Clean previous build
rm -rf .next

# Production build
npm run build

# Expected output:
# ✓ Compiled successfully
# ✓ Collecting page data
# ✓ Generating static pages
```

### Step 2: Verify Build Output

```bash
# Check build artifacts
ls -la .next/

# Size check (should be <50MB for app dir)
du -sh .next/

# Test build locally
npm start

# Visit http://localhost:3000 and verify working
```

### Step 3: Security Testing

```bash
# Run security audit
npm audit --production

# Check for vulnerabilities
npm audit --audit-level=moderate

# Update vulnerable dependencies if needed
npm audit fix
```

### Step 4: Performance Testing

```bash
# Run lighthouse audit (if using next-lighthouse)
npm run lighthouse

# Or check bundle size
npm run analyze
```

### Step 5: Smoke Testing

```bash
# Create smoke test file
cat > scripts/smoke-test.mjs << 'EOF'
import fetch from 'node-fetch';

const baseUrl = 'http://localhost:3000';
const tests = [
  { path: '/', expectedStatus: 200 },
  { path: '/api/health', expectedStatus: 200 },
  { path: '/login', expectedStatus: 200 },
  { path: '/not-found', expectedStatus: 404 },
];

for (const test of tests) {
  const res = await fetch(`${baseUrl}${test.path}`);
  const status = res.status === test.expectedStatus ? '✓' : '✗';
  console.log(`${status} GET ${test.path} => ${res.status}`);
}
EOF

node scripts/smoke-test.mjs
```

---

## Production Deployment

### Step 1: Choose Deployment Platform

**Recommended Options:**

| Platform | Best For | Cost | Setup Time |
|----------|----------|------|-----------|
| Vercel | Easiest, Next.js optimized | $20-200/mo | 5 min |
| Railway | Balance of ease & control | $5-50/mo | 10 min |
| Render | Good free tier | Free-$20/mo | 15 min |
| AWS (EC2 + RDS) | Full control, scaling | $50-500/mo | 1-2 hours |
| DigitalOcean App Platform | Simple, affordable | $12-250/mo | 20 min |
| Heroku | Simplest (deprecated free tier) | $7-50/mo | 5 min |

### Option A: Deploy to Vercel (Easiest)

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy project
vercel --prod

# Follow prompts:
# - Link to existing project or create new
# - Set environment variables
# - Confirm deployment

# Verify deployment
vercel env list
vercel logs prod
```

**Setup Environment Variables on Vercel:**
```bash
# Via CLI
vercel env add DATABASE_URL
vercel env add NEXTAUTH_SECRET
# ... (all other vars)

# Or via Vercel Dashboard:
# Project Settings > Environment Variables
```

### Option B: Deploy to Railway (Recommended for Control)

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Create project
railway init

# Link database
railway add

# Deploy
railway up

# Check logs
railway logs
```

### Option C: Deploy to Custom Server (AWS/DigitalOcean)

#### Install Node.js & PM2

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 (process manager)
sudo npm install -g pm2

# Verify
node --version
npm --version
pm2 --version
```

#### Setup Systemd Service

```bash
# Create systemd service file
sudo tee /etc/systemd/system/streamfinder.service > /dev/null << EOF
[Unit]
Description=StreamFinder v3
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/streamfinder
Environment="PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin"
Environment="NODE_ENV=production"
EnvironmentFile=/var/www/streamfinder/.env.production
ExecStart=/usr/bin/node /usr/local/bin/pm2 start npm --name streamfinder -- start
ExecReload=/usr/bin/node /usr/local/bin/pm2 reload streamfinder
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable service
sudo systemctl daemon-reload
sudo systemctl enable streamfinder
sudo systemctl start streamfinder

# Check status
sudo systemctl status streamfinder
```

#### Setup Nginx Reverse Proxy

```bash
# Install Nginx
sudo apt install -y nginx

# Create config
sudo tee /etc/nginx/sites-available/streamfinder > /dev/null << 'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name streamfinder.com www.streamfinder.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name streamfinder.com www.streamfinder.com;

    # SSL certificates (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/streamfinder.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/streamfinder.com/privkey.pem;

    # Security headers (enforced by Next.js, but double-check)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Proxy to Next.js
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Cache static assets
    location /_next/static {
        proxy_pass http://localhost:3000;
        proxy_cache_valid 30d;
        add_header Cache-Control "public, max-age=2592000, immutable";
    }

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css text/javascript application/json application/javascript;
    gzip_min_length 1024;
}
EOF

# Enable site
sudo ln -sf /etc/nginx/sites-available/streamfinder /etc/nginx/sites-enabled/streamfinder
sudo rm -f /etc/nginx/sites-enabled/default

# Test config
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

#### Setup SSL with Let's Encrypt

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Generate certificate
sudo certbot certonly --nginx -d streamfinder.com -d www.streamfinder.com

# Setup auto-renewal
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

# Verify
sudo certbot certificates
```

### Step 2: Deployment Command

```bash
# Navigate to project
cd /var/www/streamfinder

# Pull latest code
git pull origin main

# Install dependencies
npm ci  # Use ci instead of install for reproducibility

# Build
npm run build

# Run database migrations
npx prisma migrate deploy

# Start with PM2
pm2 start "npm start" --name streamfinder

# Verify running
pm2 status
pm2 logs streamfinder
```

### Step 3: Domain Configuration

```bash
# Update DNS records (via registrar)
A record: streamfinder.com -> your-server-ip
A record: www.streamfinder.com -> your-server-ip
MX record: (for email, if needed)

# Wait for DNS propagation (5-30 minutes)
nslookup streamfinder.com
```

---

## Post-Deployment Verification

### Step 1: Verify Application is Running

```bash
# Check HTTP response
curl -i https://streamfinder.com

# Should see:
# HTTP/2 200
# content-type: text/html
# strict-transport-security: max-age=31536000
# x-frame-options: DENY
```

### Step 2: Verify Security Headers

```bash
# Check headers
curl -I https://streamfinder.com

# Should include:
# ✓ Strict-Transport-Security
# ✓ X-Frame-Options: DENY
# ✓ X-Content-Type-Options: nosniff
# ✓ Content-Security-Policy
# ✓ Permissions-Policy
```

### Step 3: Test All Critical Features

```bash
# Homepage loads
curl https://streamfinder.com/

# Login page loads
curl https://streamfinder.com/login

# API health check
curl https://streamfinder.com/api/health

# Search works
curl "https://streamfinder.com/api/search?q=avatar"

# Error handling
curl https://streamfinder.com/nonexistent
```

### Step 4: Database Connectivity

```bash
# From server, test DB connection
psql -h prod-db.example.com -U dbuser -d streamfinder -c "SELECT count(*) FROM users;"

# Should return a number without errors
```

### Step 5: Monitor Logs

```bash
# If using PM2
pm2 logs streamfinder

# If using systemd
sudo journalctl -u streamfinder -f

# If using Vercel
vercel logs prod

# Watch for errors
```

### Step 6: Performance Check

```bash
# Test page load speed
curl -w "@curl-format.txt" https://streamfinder.com

# Check Core Web Vitals
# Via: https://pagespeed.web.dev/

# Monitor server resources
top
free -h
df -h
```

### Step 7: Security Scan

```bash
# SSL/TLS test
# Via: https://www.ssllabs.com/ssltest/

# Security headers test
# Via: https://securityheaders.com/

# OWASP scan
# Via: https://www.zaproxy.dev/
```

---

## Monitoring & Alerts

### Step 1: Setup Application Monitoring

**With Sentry:**

```typescript
// lib/monitoring.ts
import * as Sentry from "@sentry/nextjs";

export function captureException(error: Error, context?: Record<string, any>) {
  Sentry.captureException(error, { extra: context });
}

export function captureMessage(message: string, level: 'info' | 'warning' | 'error') {
  Sentry.captureMessage(message, level);
}
```

**Usage in API routes:**

```typescript
import { captureException } from '@/lib/monitoring';

export async function GET(req: NextRequest) {
  try {
    // ... your code
  } catch (error) {
    captureException(error as Error, {
      path: req.nextUrl.pathname,
      method: req.method,
    });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

### Step 2: Setup Uptime Monitoring

```bash
# Use a service like:
# - Uptime Robot (free): https://uptimerobot.com/
# - Betterstack: https://betterstack.com/
# - Pingdom: https://www.pingdom.com/

# Add monitoring endpoint
curl -X GET https://streamfinder.com/api/health

# Should return: {"status":"ok","timestamp":"..."}
```

### Step 3: Setup Alerting

**Create /api/health endpoint:**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    // Check database
    await prisma.$queryRaw`SELECT 1`;
    
    // Check Redis (if applicable)
    // await redis.ping();

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'connected',
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}
```

### Step 4: Setup Log Aggregation

**Using ELK Stack (Elasticsearch, Logstash, Kibana):**

```bash
# Send logs from app
npm install winston winston-elasticsearch

# Configure Winston
cat > lib/logger.ts << 'EOF'
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

export default logger;
EOF
```

### Step 5: Setup Performance Monitoring

```bash
# Use Vercel Analytics (built-in with Vercel deployment)
# Or add custom monitoring:

npm install nextjs-webvitals

// app/layout.tsx
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

---

## Rollback Procedure

### Step 1: Identify Rollback Trigger

Rollback if any of:
- [ ] Application crashes on startup
- [ ] Critical feature not working (login, search)
- [ ] Database connection fails
- [ ] Security breach detected
- [ ] Performance degradation >50%

### Step 2: Rollback Steps

**For Vercel:**

```bash
# View deployment history
vercel deployments list

# Rollback to previous deployment
vercel rollback

# Or promote specific build
vercel promote <deployment-url>
```

**For Custom Server:**

```bash
# Stop current version
pm2 stop streamfinder

# Revert to previous code
git revert HEAD
git pull origin main

# Reinstall and rebuild
npm ci
npm run build

# Re-run migrations (if needed - usually don't need to rollback DB)
npx prisma migrate status

# Start previous version
pm2 start streamfinder

# Check logs
pm2 logs streamfinder
```

### Step 3: Database Rollback (if needed)

```bash
# WARNING: Only do this if data corruption occurred

# Restore from backup
psql -h prod-db.example.com -U dbuser -d streamfinder < backup-20260619.sql

# Verify restore
npx prisma db pull --force
```

### Step 4: Notify Stakeholders

```bash
# Send message to Slack/Discord
# Incident report:
# - What went wrong
# - When detected
# - Action taken (rollback)
# - Status: RESOLVED
# - RCA to follow
```

---

## Troubleshooting

### Issue: Application won't start

```bash
# Check logs
pm2 logs streamfinder

# Or if using systemd
sudo journalctl -u streamfinder -n 50

# Common issues:
# - Missing environment variable: Check .env.production
# - Port 3000 in use: lsof -i :3000 | kill -9 $(lsof -t -i :3000)
# - Build error: npm run build (locally first)
```

### Issue: Database connection failed

```bash
# Test connection
psql -h prod-db.example.com -U dbuser -d streamfinder

# Check credentials
echo $DATABASE_URL

# Verify PostgreSQL is running
sudo systemctl status postgresql

# Or for managed DB:
# - Check security groups (AWS RDS)
# - Check firewall rules
# - Verify connection string
```

### Issue: High CPU/Memory usage

```bash
# Check process
top
ps aux | grep node

# Find memory leaks
npm install clinic
clinic doctor -- npm start

# Check logs for infinite loops
pm2 logs --err
```

### Issue: Slow performance

```bash
# Check database query performance
npx prisma studio

# Check network latency
ping prod-db.example.com

# Check server resources
free -h
df -h

# Enable query logging
# In prisma.schema: log: ["query"]
```

### Issue: SSL certificate error

```bash
# Check certificate
sudo certbot certificates

# Renew certificate
sudo certbot renew --dry-run

# Or force renewal
sudo certbot renew --force-renewal
```

### Issue: 502 Bad Gateway

```bash
# Check if app is running
pm2 status

# Check if Nginx is running
sudo systemctl status nginx

# Check Nginx config
sudo nginx -t

# Check app is listening on 3000
netstat -tlnp | grep 3000
```

### Issue: CORS errors

```bash
# Check CORS configuration in next.config.js
// next.config.js
const nextConfig = {
  async headers() {
    return [{
      source: '/api/(.*)',
      headers: [
        { key: 'Access-Control-Allow-Origin', value: 'https://frontend.com' },
        { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE' },
        { key: 'Access-Control-Allow-Headers', value: 'Content-Type,Authorization' },
      ],
    }];
  },
};
```

### Issue: CAPTCHA not working

```bash
# Verify API keys
echo $HCAPTCHA_SECRET
echo $TURNSTILE_SECRET

# Test CAPTCHA endpoint
curl -X POST https://streamfinder.com/api/verify-captcha \
  -H "Content-Type: application/json" \
  -d '{"token":"test-token"}'

# Check hCaptcha/Turnstile status page
# - https://status.hcaptcha.com
# - https://status.cloudflare.com
```

---

## Post-Deployment Checklist

After deployment, verify:

- [ ] Homepage loads correctly
- [ ] Login/Register work
- [ ] Search functionality works
- [ ] Movie details page loads
- [ ] Watchlist can be added/removed
- [ ] Reviews can be posted
- [ ] Payment processing works
- [ ] Admin panel accessible (auth only)
- [ ] Security headers present
- [ ] SSL/TLS certificate valid
- [ ] All error pages render (404, 500)
- [ ] Rate limiting works
- [ ] Logs being collected
- [ ] Monitoring alerts active
- [ ] Backups running
- [ ] Team notified

---

## Ongoing Maintenance

### Weekly

- [ ] Check application logs for errors
- [ ] Monitor resource usage (CPU, memory, disk)
- [ ] Verify backups completed successfully

### Monthly

- [ ] Review security logs
- [ ] Update dependencies (`npm update`)
- [ ] Run security audit (`npm audit`)
- [ ] Check SSL certificate expiration

### Quarterly

- [ ] Database optimization (ANALYZE, REINDEX)
- [ ] Security penetration testing
- [ ] Disaster recovery drill
- [ ] Rotate secrets/API keys

### Annually

- [ ] Major version updates (Next.js, Prisma, Node.js)
- [ ] Full security audit
- [ ] Performance benchmarking
- [ ] Architecture review

---

## Emergency Contacts

| Role | Name | Phone | Email |
|------|------|-------|-------|
| On-Call Engineer | — | — | — |
| Database Admin | — | — | — |
| Security Lead | — | — | — |
| Incident Commander | — | — | — |

---

## Deployment Completed! 🎉

Your StreamFinder v3 application is now live with production-grade security!

**Next Steps:**
1. Monitor application for first 24 hours
2. Test all critical user flows
3. Gather metrics and performance data
4. Share deployment summary with team

**Questions?** Refer to:
- `SECURITY_SUMMARY.md` — Security architecture
- `lib/security/QUICKSTART.md` — Security modules
- `DEPLOYMENT.md` — Original deployment notes (if exists)

**Happy deploying!** 🚀
