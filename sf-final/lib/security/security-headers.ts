/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SECURITY HEADERS & HTTP SECURITY CONTROLS (BONUS)
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Implements production-grade HTTP security headers to protect against:
 * 1. Cross-Site Scripting (XSS)
 * 2. Clickjacking attacks
 * 3. MIME type sniffing
 * 4. Man-in-the-Middle (MITM) attacks
 * 5. Insecure cookie usage
 * 6. Iframe injection
 * 7. Plugin-based attacks
 * 
 * Reference: OWASP Secure Headers Project
 * See: https://secureheaders.com/
 */

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 1. CONTENT SECURITY POLICY (CSP)
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * CSP prevents inline script execution and limits where scripts can load from.
 * Whitelists trusted sources for:
 * - Scripts
 * - Styles
 * - Images
 * - Fonts
 * - API calls
 * - Forms
 * 
 * THREAT: XSS attacks injecting <script> tags or event handlers
 * DEFENSE: Prevent execution of untrusted scripts
 */

export const CSP_CONFIG = {
  // Default CSP policy (fallback for unspecified directives)
  'default-src': ["'self'"],

  // Script sources (strictest setting: only same-origin, no inline)
  'script-src': [
    "'self'",                           // Same origin only
    // Add trusted CDNs here as needed:
    // 'https://trusted-cdn.com',
  ],

  // Inline scripts: use nonce or hash
  // Example nonce in template: <script nonce="YOUR_NONCE">...</script>
  // Build hash of inline script: sha256-HASH_HERE
  'script-src-elem': ["'self'"],
  'script-src-attr': ["'none'"],        // No inline event handlers

  // Style sources
  'style-src': [
    "'self'",
    "'unsafe-inline'",                  // Required for Tailwind CSS (consider alternatives)
    'https://fonts.googleapis.com',     // Google Fonts
  ],

  // Unsafe-inline fonts allowed (you can restrict this later)
  'style-src-elem': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  'style-src-attr': ["'none'"],         // No inline style attributes

  // Image sources
  'img-src': [
    "'self'",
    'data:',                            // Data URLs
    'https:',                           // HTTPS images from anywhere (consider restricting)
    'https://image.tmdb.org',           // TMDB images
    'https://lh3.googleusercontent.com', // Google OAuth images
    'https://avatars.githubusercontent.com', // GitHub avatars
  ],

  // Font sources (for web fonts)
  'font-src': [
    "'self'",
    'https://fonts.gstatic.com',        // Google Fonts
    'data:',                            // Data URLs
  ],

  // Media sources (audio/video)
  'media-src': ["'self'"],

  // Connect sources (API calls, WebSockets, beacons)
  'connect-src': [
    "'self'",
    'https://api.themoviedb.org',       // TMDB API
    'https://hcaptcha.com',             // hCaptcha
    'https://challenges.cloudflare.com', // Turnstile
    'https://*.sentry.io',              // Sentry error tracking
  ],

  // Iframe sources (embedding)
  'frame-src': [
    'https://hcaptcha.com',
    'https://challenges.cloudflare.com',
  ],

  // Form submission targets
  'form-action': ["'self'"],

  // Base URI (src for <base> tag)
  'base-uri': ["'self'"],

  // Frame ancestors (who can embed this page)
  'frame-ancestors': ["'none'"],        // Prevent clickjacking

  // Object/embed sources (Flash, plugins)
  'object-src': ["'none'"],             // Disable plugins

  // Manifest sources (PWA manifest)
  'manifest-src': ["'self'"],

  // Worker sources (Service Workers, Web Workers)
  'worker-src': ["'self'"],

  // Child frame sources
  'child-src': ["'self'"],

  // Prefetch/preload sources
  'prefetch-src': ["'self'"],

  // Upgrade insecure requests to HTTPS
  'upgrade-insecure-requests': true,

  // Block all mixed content
  'block-all-mixed-content': true,

  // Report violations (set your report endpoint)
  'report-uri': [
    // 'https://your-domain.com/api/csp-report'
  ],

  // Use report-to over deprecated report-uri
  'report-to': ['default'],

  // Sandbox (if you embed iframes, restrict what they can do)
  'sandbox': [
    'allow-same-origin',
    'allow-scripts',
    'allow-forms',
    'allow-popups',
    'allow-popups-to-escape-sandbox',
  ],
} as const;

/**
 * Build CSP header string from config
 * 
 * @example
 * const cspHeader = buildCSPHeader();
 * // Output: "default-src 'self'; script-src 'self'; ..."
 */
export function buildCSPHeader(config = CSP_CONFIG): string {
  const directives: string[] = [];

  for (const [directive, values] of Object.entries(config)) {
    if (directive === 'upgrade-insecure-requests' || directive === 'block-all-mixed-content') {
      // These are flagless directives
      if (values === true) {
        directives.push(directive);
      }
    } else if (Array.isArray(values)) {
      directives.push(`${directive} ${values.join(' ')}`);
    }
  }

  return directives.join('; ');
}

/**
 * Generate CSP nonce for inline scripts
 * 
 * Use a unique nonce per request to allow specific inline scripts.
 * This avoids 'unsafe-inline' which disables most XSS protection.
 * 
 * @example
 * // In API route
 * const nonce = generateCSPNonce();
 * const csp = buildCSPHeader({ ...CSP_CONFIG, 'script-src-elem': [`'nonce-${nonce}'`] });
 * 
 * // In template
 * <script nonce={nonce}>...</script>
 */
export function generateCSPNonce(): string {
  return Buffer.from(Math.random().toString()).toString('base64').slice(0, 20);
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 2. HTTP STRICT TRANSPORT SECURITY (HSTS)
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * HSTS forces HTTPS and prevents downgrade attacks.
 * 
 * THREAT: MITM attacker intercepts HTTP and serves malicious content
 * DEFENSE: Browser enforces HTTPS for all future requests
 */

export const HSTS_HEADER = {
  // max-age: How long (in seconds) to enforce HTTPS
  maxAge: 63072000, // 2 years (maximum safe value)

  // includeSubDomains: Apply to all subdomains
  includeSubDomains: true,

  // preload: Add to HSTS preload list (optional but recommended)
  preload: true,
} as const;

/**
 * Build HSTS header string
 * 
 * @example
 * const hstsHeader = buildHSTSHeader();
 * // Output: "max-age=63072000; includeSubDomains; preload"
 */
export function buildHSTSHeader(config = HSTS_HEADER): string {
  const parts = [`max-age=${config.maxAge}`];

  if (config.includeSubDomains) {
    parts.push('includeSubDomains');
  }

  if (config.preload) {
    parts.push('preload');
  }

  return parts.join('; ');
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 3. X-FRAME-OPTIONS (Clickjacking Protection)
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Prevents your site from being embedded in iframes.
 * 
 * THREAT: Clickjacking - attacker embeds your page in hidden iframe, tricks user
 * DEFENSE: Prevent embedding (or allow only same-origin)
 */

export const X_FRAME_OPTIONS = {
  // DENY: Never allow framing (most secure)
  // SAMEORIGIN: Allow only same-origin framing
  // ALLOWALL: Allow any framing (least secure)
  value: 'DENY' as 'DENY' | 'SAMEORIGIN' | 'ALLOWALL',
} as const;

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 4. X-CONTENT-TYPE-OPTIONS (MIME Sniffing Prevention)
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Prevents browser from guessing content type.
 * 
 * THREAT: Browser MIME-sniffs file and executes as script
 * DEFENSE: Enforce declared content type
 */

export const X_CONTENT_TYPE_OPTIONS = 'nosniff' as const;

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 5. X-XSS-PROTECTION (Browser XSS Filter - Legacy)
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Legacy header (modern browsers use CSP instead).
 * Still useful for older browsers.
 */

export const X_XSS_PROTECTION = '1; mode=block' as const;

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 6. REFERRER-POLICY (Referrer Control)
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Controls how much referrer info is sent to other sites.
 * 
 * Options:
 * - no-referrer: Never send referrer
 * - strict-origin-when-cross-origin: (recommended) Only send origin on cross-site
 * - same-origin: Only send to same-origin requests
 */

export const REFERRER_POLICY = 'strict-origin-when-cross-origin' as const;

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 7. PERMISSIONS-POLICY (Permissions & Features Control)
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Disables dangerous browser features (camera, microphone, geolocation, etc.)
 * 
 * THREAT: Embedded ads/scripts accessing camera, location without user knowledge
 * DEFENSE: Explicitly disable features you don't need
 */

export const PERMISSIONS_POLICY = {
  // Camera access
  camera: [],

  // Microphone access
  microphone: [],

  // Geolocation
  geolocation: [],

  // Payment API
  payment: [],

  // USB access
  usb: [],

  // Magnetometer
  magnetometer: [],

  // Gyroscope
  gyroscope: [],

  // Accelerometer
  accelerometer: [],

  // Ambient light sensor
  'ambient-light-sensor': [],

  // Google FLoC (Federated Learning of Cohorts) - privacy tracking
  'interest-cohort': [],

  // Sync events
  sync: [],

  // Notifications
  notifications: [],

  // MIDI
  midi: [],

  // VR displays
  vr: ['self'],

  // XR device access
  'xr-spatial-tracking': [],
} as const;

/**
 * Build Permissions-Policy header
 * 
 * @example
 * const ppHeader = buildPermissionsPolicyHeader();
 * // Output: "camera=(), microphone=(), ..."
 */
export function buildPermissionsPolicyHeader(
  config = PERMISSIONS_POLICY
): string {
  const directives: string[] = [];

  for (const [feature, allowedOrigins] of Object.entries(config)) {
    if (allowedOrigins.length === 0) {
      directives.push(`${feature}=()`);
    } else {
      const origins = allowedOrigins.map(o => o === 'self' ? '(self)' : `"${o}"`).join(' ');
      directives.push(`${feature}=(${origins})`);
    }
  }

  return directives.join(', ');
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 8. SECURE COOKIE ATTRIBUTES
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Configuration for setting secure cookies (session, auth tokens, etc.)
 * 
 * Attributes:
 * - HttpOnly: Not accessible from JavaScript (prevents XSS theft)
 * - Secure: Only sent over HTTPS
 * - SameSite: Protects against CSRF attacks
 * - Path: Only sent to specific paths
 * - Domain: Which domains can access the cookie
 */

export function getSecureCookieOptions(
  options: { domain?: string; path?: string } = {}
) {
  return {
    httpOnly: true,                     // Not accessible from JavaScript
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    sameSite: 'Strict' as const,        // Strict CSRF protection (Strict/Lax/None)
    path: options.path ?? '/',
    domain: options.domain,             // Set for cross-subdomain sharing if needed
    maxAge: 24 * 60 * 60 * 1000,       // 24 hours
  };
}

/**
 * Generate Set-Cookie header value
 * 
 * @example
 * const header = buildSetCookieHeader('sessionId', tokenValue, { path: '/' });
 */
export function buildSetCookieHeader(
  name: string,
  value: string,
  options = getSecureCookieOptions()
): string {
  const parts = [`${name}=${value}`];

  if (options.maxAge) {
    parts.push(`Max-Age=${Math.floor(options.maxAge / 1000)}`);
  }

  if (options.path) {
    parts.push(`Path=${options.path}`);
  }

  if (options.domain) {
    parts.push(`Domain=${options.domain}`);
  }

  if (options.httpOnly) {
    parts.push('HttpOnly');
  }

  if (options.secure) {
    parts.push('Secure');
  }

  if (options.sameSite) {
    parts.push(`SameSite=${options.sameSite}`);
  }

  return parts.join('; ');
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * NEXT.JS CONFIGURATION
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Integration with next.config.js for automatic header injection.
 */

export function getSecurityHeadersConfig() {
  return [
    // CSP
    {
      key: 'Content-Security-Policy',
      value: buildCSPHeader(),
    },

    // HSTS (only in production)
    ...(process.env.NODE_ENV === 'production'
      ? [{
          key: 'Strict-Transport-Security',
          value: buildHSTSHeader(),
        }]
      : []),

    // Clickjacking protection
    {
      key: 'X-Frame-Options',
      value: X_FRAME_OPTIONS.value,
    },

    // MIME sniffing prevention
    {
      key: 'X-Content-Type-Options',
      value: X_CONTENT_TYPE_OPTIONS,
    },

    // XSS protection (legacy)
    {
      key: 'X-XSS-Protection',
      value: X_XSS_PROTECTION,
    },

    // Referrer policy
    {
      key: 'Referrer-Policy',
      value: REFERRER_POLICY,
    },

    // Permissions policy
    {
      key: 'Permissions-Policy',
      value: buildPermissionsPolicyHeader(),
    },

    // Additional security headers
    {
      key: 'X-DNS-Prefetch-Control',
      value: 'on', // Allow DNS prefetching
    },

    {
      key: 'X-Permitted-Cross-Domain-Policies',
      value: 'none',
    },

    {
      key: 'Cross-Origin-Embedder-Policy',
      value: 'require-corp', // Require CORS for cross-origin resources
    },

    {
      key: 'Cross-Origin-Opener-Policy',
      value: 'same-origin-allow-popups',
    },

    {
      key: 'Cross-Origin-Resource-Policy',
      value: 'cross-origin',
    },
  ];
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MIDDLEWARE FOR DYNAMIC HEADER INJECTION
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Use this in middleware.ts for per-request header customization
 * (e.g., per-request CSP nonce).
 */

export function createSecurityHeadersMiddleware() {
  return (req: any, res: any, next: any) => {
    // Generate nonce for this request
    const nonce = generateCSPNonce();

    // Set CSP header with nonce
    res.setHeader(
      'Content-Security-Policy',
      buildCSPHeader({
        ...CSP_CONFIG,
        'script-src': ["'self'", `'nonce-${nonce}'`],
      })
    );

    // Set other security headers
    res.setHeader('X-Frame-Options', X_FRAME_OPTIONS.value);
    res.setHeader('X-Content-Type-Options', X_CONTENT_TYPE_OPTIONS);
    res.setHeader('X-XSS-Protection', X_XSS_PROTECTION);
    res.setHeader('Referrer-Policy', REFERRER_POLICY);
    res.setHeader('Permissions-Policy', buildPermissionsPolicyHeader());

    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', buildHSTSHeader());
    }

    // Make nonce available to templates
    res.locals.cspNonce = nonce;

    next();
  };
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * NEXT.JS MIDDLEWARE.TS EXAMPLE
 * ═══════════════════════════════════════════════════════════════════════════
 */

export const MIDDLEWARE_EXAMPLE = `
// middleware.ts
import { NextResponse, NextRequest } from 'next/server';
import { getSecurityHeadersConfig } from '@/lib/security/security-headers';

export function middleware(req: NextRequest) {
  const response = NextResponse.next();

  // Add security headers
  const headers = getSecurityHeadersConfig();
  for (const { key, value } of headers) {
    response.headers.set(key, value);
  }

  return response;
}

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
};
`;

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * NEXT.CONFIG.JS EXAMPLE
 * ═══════════════════════════════════════════════════════════════════════════
 */

export const NEXT_CONFIG_EXAMPLE = `
// next.config.js
import { getSecurityHeadersConfig } from '@/lib/security/security-headers';

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

export default nextConfig;
`;

export default {
  CSP_CONFIG,
  HSTS_HEADER,
  X_FRAME_OPTIONS,
  X_CONTENT_TYPE_OPTIONS,
  X_XSS_PROTECTION,
  REFERRER_POLICY,
  PERMISSIONS_POLICY,
  buildCSPHeader,
  generateCSPNonce,
  buildHSTSHeader,
  buildPermissionsPolicyHeader,
  getSecureCookieOptions,
  buildSetCookieHeader,
  getSecurityHeadersConfig,
  createSecurityHeadersMiddleware,
  MIDDLEWARE_EXAMPLE,
  NEXT_CONFIG_EXAMPLE,
};
