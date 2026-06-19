# 🔐 StreamFinder v3 — Complete Security Blueprint

## Executive Summary

This comprehensive security architecture provides production-grade protection against all major web application vulnerabilities. All code follows the principle of **least privilege** and implements **defense-in-depth** strategies with multiple layers of protection.

---

## 📋 Table of Contents

1. [Security Modules Overview](#security-modules-overview)
2. [Vulnerability Coverage](#vulnerability-coverage)
3. [Architecture Layers](#architecture-layers)
4. [Implementation Examples](#implementation-examples)
5. [Deployment Checklist](#deployment-checklist)
6. [Monitoring & Incident Response](#monitoring--incident-response)

---

## Security Modules Overview

### 1. **SSTI Protection** (`ssti-protection.ts`)

**Problem:** Server-Side Template Injection allows attackers to inject malicious template code.

**Solution:**
- Type-safe JSX (not a template engine)
- Whitelist-based context validation
- HTML escaping of all dynamic content
- Blocked dangerous template patterns
- No `eval()` or `Function()` constructors

**Usage:**
```typescript
import { validateTemplateContext, renderSafeMetaTags } from '@/lib/security/ssti-protection';

const context = validateTemplateContext(userData);
const meta = renderSafeMetaTags(context);
```

**Key Functions:**
- `validateTemplateContext()` — Strict type & value validation
- `renderSafeMetaTags()` — Safe HTML generation
- `isSSTISuspicious()` — Detect injection patterns
- `assertNoSSTI()` — Guard against SSTI

---

### 2. **ReDoS Protection** (`redos-protection.ts`)

**Problem:** Regular expressions with catastrophic backtracking can freeze the server.

**Solution:**
- Pre-validated safe regex patterns (whitelist)
- Timeout enforcement for regex operations
- Input length restrictions
- Detection of dangerous regex constructs
- Safe validator functions (no regex)

**Usage:**
```typescript
import { safeRegexTest, SAFE_REGEX, validateRegexSafety } from '@/lib/security/redos-protection';

const isValid = await safeRegexTest(userInput, /^[a-z0-9]+$/);
```

**Key Functions:**
- `validateRegexSafety()` — Check for ReDoS vulnerabilities
- `safeRegexTest()`, `safeRegexMatch()`, `safeRegexReplace()` — Timeout-wrapped operations
- `SAFE_REGEX.*` — Pre-validated patterns
- `SAFE_VALIDATORS.*` — Regex-free validation

---

### 3. **LP DoS Protection** (`lpdos-protection.ts`)

**Problem:** Application-layer DoS through expensive operations, large payloads, concurrency.

**Solution:**
- Concurrency limits per IP/user
- Payload size limits
- Request timeouts
- Complexity budget system
- Object nesting depth restrictions

**Usage:**
```typescript
import { checkLPDoSLimits, createComplexityBudget, withTimeout } from '@/lib/security/lpdos-protection';

const budget = createComplexityBudget(100);
budget.assert(10, 'database_query');

const result = await withTimeout(expensiveQuery(), 5000, 'Search');
```

**Key Functions:**
- `checkConcurrencyLimits()` — Rate by IP/user
- `validatePayloadSize()` — Enforce size limits
- `validateObjectComplexity()` — Prevent deep nesting attacks
- `createComplexityBudget()` — Track computational cost
- `withTimeout()` — Wrap async operations

---

### 4. **Secret Protection** (`secret-protection.ts`)

**Problem:** Secrets (API keys, passwords) accidentally committed to git.

**Solution:**
- Environment variable validation at startup
- Secret access logging
- Pre-commit hook to detect secrets
- Sanitization of error messages
- Template configuration files

**Usage:**
```typescript
import { validateEnvironmentSecrets, getSecret, scanForSecrets } from '@/lib/security/secret-protection';

// Validate on startup
validateEnvironmentSecrets('NEXTAUTH_SECRET', 'DATABASE_URL');

// Safe access
const dbUrl = getSecret('DATABASE_URL');

// Detect in code
const findings = scanForSecrets(fileContent);
```

**Key Functions:**
- `validateEnvironmentSecrets()` — Startup validation
- `getSecret()` — Safe access with logging
- `scanForSecrets()` — Detect secret patterns
- `sanitizeErrorMessage()` — Remove secrets from errors

---

### 5. **SQL/NoSQL Injection Protection** (`injection-protection.ts`)

**Problem:** User input directly in database queries causes injection attacks.

**Solution:**
- Zod schema validation (type-safe)
- Type casting with length/pattern validation
- Suspicious pattern detection
- Parameterized queries via Prisma ORM

**Usage:**
```typescript
import { SearchQuerySchema, isSuspiciousSQLInput } from '@/lib/security/injection-protection';

// Layer 1: Schema validation
const validated = SearchQuerySchema.parse(userInput);

// Layer 2: Pattern detection
if (isSuspiciousSQLInput(validated.q)) throw new Error('Invalid');

// Layer 3: Database query (Prisma uses parameterized queries)
const results = await prisma.movie.findMany({
  where: { title: { contains: validated.q } }
});
```

**Key Functions:**
- `*Schema` — Zod validation schemas
- `castAndValidateId()`, `castAndValidateString()`, etc. — Type casting
- `isSuspiciousSQLInput()`, `isSuspiciousNoSQLInput()` — Pattern detection
- `searchMovies()`, `bulkInsertReviews()` — Safe query helpers

---

### 6. **Clipboard Attack Protection** (`clipboard-protection.ts`)

**Problem:** Malicious content pasted from clipboard can inject scripts/payloads.

**Solution:**
- Paste event interception
- Clipboard content sanitization
- Size and rate limiting
- Format validation
- User feedback

**Usage:**
```typescript
// Frontend component
import { createClipboardPasteHandler } from '@/lib/security/clipboard-protection';

const handlePaste = createClipboardPasteHandler({
  maxSize: 1000,
  allowMultiline: false,
  onPasteSuccessful: (data) => console.log('Safe:', data),
});

// In API route
import { sanitizeClipboardContent } from '@/lib/security/clipboard-protection';

const result = await sanitizeClipboardContent(userPastedText);
```

**Key Functions:**
- `sanitizeClipboardContent()` — Backend sanitization
- `createClipboardPasteHandler()` — Frontend handler
- `useClipboardSecurity()` — React hook
- Validation functions: `validateClipboardAsEmail()`, etc.

---

### 7. **Replay Attack Protection** (`replay-protection.ts`)

**Problem:** Attacker replays valid requests to bypass protections or repeat actions.

**Solution:**
- Cryptographic nonces (one-time use)
- CSRF tokens (session-bound)
- Session tokens with JWT expiration
- Nonce tracking and reuse detection
- Attack pattern monitoring

**Usage:**
```typescript
import { generateNonce, validateNonce, generateCSRFToken } from '@/lib/security/replay-protection';

// On form load
const nonce = generateNonce();
registerNonce(nonce);

// On form submission
const valid = validateNonce(userSubmittedNonce);
if (!valid.valid) throw new Error(valid.reason);
// Nonce is now consumed, cannot be reused
```

**Key Functions:**
- `generateNonce()`, `registerNonce()`, `validateNonce()` — One-time tokens
- `generateCSRFToken()`, `validateCSRFToken()` — Session-bound tokens
- `createSessionToken()`, `validateSessionToken()` — JWT session tokens
- `createNonceValidationMiddleware()` — Express middleware

---

### 8. **Security Headers** (`security-headers.ts`) ⭐ Bonus

**Problem:** Missing HTTP headers leave application vulnerable to XSS, clickjacking, MITM.

**Solution:**
- Content Security Policy (CSP)
- HTTP Strict Transport Security (HSTS)
- X-Frame-Options
- X-Content-Type-Options
- Permissions-Policy
- Secure cookie attributes

**Usage:**
```typescript
import { getSecurityHeadersConfig, buildCSPHeader } from '@/lib/security/security-headers';

// In next.config.js
async headers() {
  return [{ source: '/(.*)', headers: getSecurityHeadersConfig() }];
}

// Custom CSP with nonce
const nonce = generateCSPNonce();
const csp = buildCSPHeader({
  ...CSP_CONFIG,
  'script-src-elem': [`'nonce-${nonce}'`],
});
```

**Key Functions:**
- `buildCSPHeader()` — Generate CSP
- `buildHSTSHeader()` — Generate HSTS
- `buildPermissionsPolicyHeader()` — Control features
- `getSecurityHeadersConfig()` — All headers for next.config.js
- `getSecureCookieOptions()` — Secure cookie attributes

---

## Vulnerability Coverage

| Vulnerability | Protection Module | Mechanism |
|---|---|---|
| **SSTI** | ssti-protection.ts | Type-safe JSX, context whitelist |
| **ReDoS** | redos-protection.ts | Regex validation, timeouts |
| **LP DoS** | lpdos-protection.ts | Rate limits, complexity budgets |
| **Secret Leaks** | secret-protection.ts | Pre-commit hook, validation |
| **SQL Injection** | injection-protection.ts | Zod schemas, parameterized queries |
| **NoSQL Injection** | injection-protection.ts | Zod schemas, pattern detection |
| **Clipboard Attacks** | clipboard-protection.ts | Content sanitization, validation |
| **Replay Attacks** | replay-protection.ts | Nonces, CSRF tokens |
| **XSS** | security-headers.ts | CSP, secure cookie attributes |
| **Clickjacking** | security-headers.ts | X-Frame-Options: DENY |
| **MIME Sniffing** | security-headers.ts | X-Content-Type-Options |
| **MITM** | security-headers.ts | HSTS, secure cookies |
| **CSRF** | replay-protection.ts + middleware | CSRF token, SameSite cookies |

---

## Architecture Layers

### Layer 1: Request Layer (middleware.ts)
```
┌─ Rate Limiting (per IP/user/endpoint)
├─ Bot Detection
├─ CSRF Token Validation
├─ Attack Probe Detection
└─ Security Headers Injection
```

### Layer 2: Input Validation Layer (API routes)
```
┌─ Zod Schema Validation
├─ Type Casting
├─ Suspicious Pattern Detection
├─ Size/Length Validation
└─ Clipboard Sanitization
```

### Layer 3: Database Layer (Prisma ORM)
```
┌─ Parameterized Queries (automatic via Prisma)
├─ Type Safety (TypeScript)
├─ Relationship Validation
└─ Transaction Management
```

### Layer 4: Session & Auth Layer
```
┌─ Nonces (one-time use)
├─ CSRF Tokens (session-bound)
├─ Session Tokens (JWT with expiration)
└─ Replay Attack Detection
```

### Layer 5: Response Layer (headers)
```
┌─ CSP (Content Security Policy)
├─ HSTS (Strict Transport Security)
├─ X-Frame-Options (Clickjacking)
├─ Secure Cookie Attributes
└─ Permissions Policy
```

### Layer 6: Client Layer (forms/clipboard)
```
┌─ Input Escaping
├─ Clipboard Sanitization
├─ Event Handler Validation
└─ Form CSRF Token Inclusion
```

---

## Implementation Examples

### Example 1: Secure Form Submission

```typescript
// Frontend component
export function ReviewForm() {
  const [nonce, setNonce] = useState('');
  const [csrfToken, setCsrfToken] = useState('');

  // Generate tokens on mount
  useEffect(() => {
    fetch('/api/auth/tokens', { method: 'POST' })
      .then(r => r.json())
      .then(d => {
        setNonce(d.nonce);
        setCsrfToken(d.csrfToken);
      });
  }, []);

  return (
    <form onSubmit={async (e) => {
      e.preventDefault();
      const res = await fetch('/api/reviews', {
        method: 'POST',
        body: JSON.stringify({
          title: e.currentTarget.title.value,
          rating: e.currentTarget.rating.value,
          content: e.currentTarget.content.value,
          nonce,           // One-time token
          csrfToken,       // Session-bound token
          captchaToken,    // Bot protection
        }),
      });
      // ...
    }}>
      <input name="title" required />
      <select name="rating">{/* 1-10 */}</select>
      <textarea name="content" required />
      <CaptchaWidget />
      <button type="submit">Submit</button>
    </form>
  );
}
```

```typescript
// Backend API route
export async function POST(req: NextRequest) {
  const ip = getClientIP(req);
  const session = await getServerSession(authOptions);

  // 1. Rate limit
  const rateLimit = await rateLimit(ip, 'REVIEW_SUBMIT');
  if (!rateLimit.success) return new NextResponse('Too many requests', { status: 429 });

  // 2. Authenticate
  if (!session?.user?.id) return new NextResponse('Unauthorized', { status: 401 });

  const body = await req.json();

  // 3. Validate nonce (one-time use)
  if (!validateNonce(body.nonce).valid) {
    return new NextResponse('Invalid nonce', { status: 403 });
  }

  // 4. Validate CSRF token
  if (!validateCSRFToken(session.user.id, body.csrfToken)) {
    return new NextResponse('Invalid CSRF token', { status: 403 });
  }

  // 5. Verify CAPTCHA
  const captcha = await verifyCaptcha(body.captchaToken, ip);
  if (!captcha.success) return new NextResponse('CAPTCHA failed', { status: 400 });

  // 6. Validate input schema
  const validated = ReviewSchema.parse(body);

  // 7. Detect injection patterns
  if (isSuspiciousSQLInput(validated.content)) {
    return new NextResponse('Invalid content', { status: 400 });
  }

  // 8. Create in database (parameterized query via Prisma)
  const review = await prisma.review.create({
    data: {
      userId: session.user.id,
      movieId: parseInt(validated.movieId),
      ...validated,
    },
  });

  return NextResponse.json({ success: true });
}
```

### Example 2: Secure Search with ReDoS & LP DoS Protection

```typescript
export async function GET(req: NextRequest) {
  const ip = getClientIP(req);
  const { searchParams } = new URL(req.url);

  // 1. Rate limit
  const rl = await rateLimit(ip, 'SEARCH');
  if (!rl.success) return new NextResponse('Rate limited', { status: 429 });

  // 2. Validate schema
  const query = SearchQuerySchema.parse({
    q: searchParams.get('q'),
    limit: parseInt(searchParams.get('limit') || '20'),
  });

  // 3. Check for injection patterns
  if (isSuspiciousSQLInput(query.q)) {
    return new NextResponse('Invalid query', { status: 400 });
  }

  // 4. Check payload size
  const sizeCheck = validatePayloadSize(query, 'application/json');
  if (!sizeCheck.valid) return new NextResponse(sizeCheck.reason, { status: 413 });

  // 5. Execute with timeout
  const results = await withTimeout(
    prisma.movie.findMany({
      where: {
        title: { contains: query.q, mode: 'insensitive' },
      },
      take: query.limit,
    }),
    15000, // 15 second timeout
    'Movie search'
  );

  return NextResponse.json(results);
}
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] All environment variables configured (run `validateEnvironmentSecrets()`)
- [ ] Database migrations applied
- [ ] SSL/TLS certificate configured
- [ ] HSTS preload list submission prepared
- [ ] CSP report endpoint configured
- [ ] Error tracking (Sentry) configured
- [ ] Rate limiting Redis instance provisioned
- [ ] CAPTCHA service configured
- [ ] Email service configured (for password resets)
- [ ] Secrets rotated

### Security Headers

- [ ] CSP header configured and tested
- [ ] HSTS enabled in production
- [ ] X-Frame-Options set to DENY
- [ ] X-Content-Type-Options set to nosniff
- [ ] Permissions-Policy restricts unnecessary features
- [ ] Secure cookies enabled (HttpOnly, Secure, SameSite)

### API Routes

- [ ] All state-changing routes have nonce/CSRF protection
- [ ] All user input validated with Zod schemas
- [ ] Rate limiting configured per endpoint
- [ ] Timeouts configured for expensive operations
- [ ] Error messages sanitized (no secrets)
- [ ] Logging configured (track suspicious patterns)

### Frontend

- [ ] Clipboard sanitization implemented on sensitive fields
- [ ] Forms include nonce and CSRF tokens
- [ ] CAPTCHA integrated
- [ ] Input validation on client-side
- [ ] No secrets in JavaScript bundles

### Monitoring

- [ ] CSP violation reporting enabled
- [ ] Rate limit violations logged
- [ ] Replay attack detector active
- [ ] Secret access logging enabled
- [ ] Error tracking dashboard configured
- [ ] Performance monitoring active

### Incident Response

- [ ] Runbook created for security incidents
- [ ] Secret rotation procedure documented
- [ ] Database backup verified
- [ ] Rollback procedure tested
- [ ] On-call rotation established

---

## Monitoring & Incident Response

### Key Metrics to Monitor

```typescript
// Track in your monitoring system
{
  rate_limit_violations: count,           // Per IP/endpoint
  csrf_validation_failures: count,        // Possible CSRF attacks
  nonce_reuse_attempts: count,            // Possible replay attacks
  injection_pattern_detections: count,    // SQL/NoSQL injection attempts
  ssti_suspicious_patterns: count,        // Template injection attempts
  redos_timeout_triggers: count,          // Regex DoS attempts
  clipboard_sanitization_failures: count, // Malicious clipboard content
  authentication_failures: count,         // Failed login attempts
  captcha_verification_failures: count,   // Bot activity
}
```

### Alert Thresholds

- **CRITICAL**: 10+ CSRF failures from single IP
- **CRITICAL**: 5+ nonce reuse attempts
- **HIGH**: 20+ rate limit violations / minute
- **HIGH**: Injection patterns detected
- **MEDIUM**: Multiple SSTI patterns in logs
- **INFO**: Normal replay attack detector activity

### Incident Response Procedures

1. **Secret Leaked**: 
   - Revoke immediately
   - Rotate in all systems
   - Audit access logs
   - Update dependent systems

2. **SQL Injection Attempt**:
   - Log IP and request details
   - Review database audit logs
   - Check for unauthorized data access
   - Consider IP blocking

3. **Replay Attack Detected**:
   - Invalidate nonces for user
   - Force re-authentication
   - Review session logs
   - Consider IP blocking

---

## Reference Documentation

- **OWASP**: https://owasp.org/www-project-top-ten/
- **Secure Headers**: https://secureheaders.com/
- **CSP Guide**: https://content-security-policy.com/
- **HSTS Preload**: https://hstspreload.org/
- **Zod Documentation**: https://zod.dev/
- **Prisma Security**: https://www.prisma.io/docs/orm/prisma-client/deployment/deployment-best-practices

---

## Support & Questions

For security-related questions or to report vulnerabilities:
- Review the inline documentation in each security module
- Check the INTEGRATION_GUIDE.md for setup instructions
- Consult OWASP guidelines for security concepts
- Never commit actual secrets to version control

**Remember**: Security is a process, not a destination. Regular audits, updates, and monitoring are essential.
