/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SECRET KEY LEAK PROTECTION
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Protects sensitive credentials by:
 * 1. Enforcing environment variable configuration (zero-secrets in code)
 * 2. Validating environment variables at startup
 * 3. Detecting hardcoded secrets in code at commit time (pre-commit hook)
 * 4. Implementing secure secret rotation strategies
 * 5. Monitoring and alerting on potential leaks
 * 
 * THREAT MODELS:
 * - Developer accidentally commits API keys, database passwords
 * - Secrets exposed in error messages or logs
 * - Secrets visible in source code repositories
 * - Secrets transmitted over unencrypted channels
 * - Secrets stored in browser localStorage/cookies
 * 
 * Best Practices:
 * - NEVER commit secrets to version control
 * - Use .env.local (git-ignored) for development
 * - Use managed secret services for production (AWS Secrets Manager, HashiCorp Vault, etc.)
 * - Rotate secrets regularly
 * - Use short-lived credentials when possible
 * - Log secret usage, not the secrets themselves
 */

/**
 * Secret types and their validation rules
 */
export enum SecretType {
  API_KEY = 'api_key',
  DATABASE_PASSWORD = 'database_password',
  JWT_SECRET = 'jwt_secret',
  ENCRYPTION_KEY = 'encryption_key',
  OAUTH_SECRET = 'oauth_secret',
  WEBHOOK_SECRET = 'webhook_secret',
  PAYMENT_KEY = 'payment_key',
  CAPTCHA_SECRET = 'captcha_secret',
}

/**
 * Secret configuration with validation rules
 */
interface SecretConfig {
  required: boolean;
  minLength: number;
  pattern?: RegExp;
  type: SecretType;
}

/**
 * Mapping of environment variable names to their configurations
 */
const SECRET_CONFIGS: Record<string, SecretConfig> = {
  // Authentication
  NEXTAUTH_SECRET: {
    required: true,
    minLength: 32,
    type: SecretType.JWT_SECRET,
  },
  NEXTAUTH_URL: {
    required: true,
    minLength: 10,
    type: SecretType.API_KEY,
  },

  // Database
  DATABASE_URL: {
    required: true,
    minLength: 20,
    pattern: /^(postgresql|mysql|mongodb):\/\/.+/,
    type: SecretType.DATABASE_PASSWORD,
  },

  // OAuth Providers
  GOOGLE_CLIENT_ID: {
    required: false,
    minLength: 10,
    type: SecretType.OAUTH_SECRET,
  },
  GOOGLE_CLIENT_SECRET: {
    required: false,
    minLength: 20,
    type: SecretType.OAUTH_SECRET,
  },
  GITHUB_CLIENT_ID: {
    required: false,
    minLength: 10,
    type: SecretType.OAUTH_SECRET,
  },
  GITHUB_CLIENT_SECRET: {
    required: false,
    minLength: 20,
    type: SecretType.OAUTH_SECRET,
  },

  // Payment Gateways
  STRIPE_SECRET_KEY: {
    required: false,
    minLength: 20,
    pattern: /^sk_/,
    type: SecretType.PAYMENT_KEY,
  },
  STRIPE_WEBHOOK_SECRET: {
    required: false,
    minLength: 20,
    pattern: /^whsec_/,
    type: SecretType.WEBHOOK_SECRET,
  },
  RAZORPAY_KEY_ID: {
    required: false,
    minLength: 10,
    type: SecretType.PAYMENT_KEY,
  },
  RAZORPAY_KEY_SECRET: {
    required: false,
    minLength: 20,
    type: SecretType.PAYMENT_KEY,
  },

  // CAPTCHA
  HCAPTCHA_SECRET_KEY: {
    required: false,
    minLength: 20,
    type: SecretType.CAPTCHA_SECRET,
  },
  TURNSTILE_SECRET_KEY: {
    required: false,
    minLength: 20,
    type: SecretType.CAPTCHA_SECRET,
  },

  // External APIs
  TMDB_API_KEY: {
    required: true,
    minLength: 20,
    type: SecretType.API_KEY,
  },
  REDIS_URL: {
    required: false,
    minLength: 10,
    pattern: /^redis:\/\/.+/,
    type: SecretType.DATABASE_PASSWORD,
  },
};

/**
 * STARTUP: Validate all required environment variables are present and valid
 * 
 * Call this in your app initialization (e.g., pages/api/[...].ts or middleware.ts)
 * Fails fast on startup if critical secrets are missing.
 * 
 * @example
 * // Call early in your application lifecycle
 * validateEnvironmentSecrets();
 * 
 * // Or in a specific API route:
 * export async function handler(req, res) {
 *   validateEnvironmentSecrets('STRIPE_SECRET_KEY', 'NEXTAUTH_SECRET');
 *   // ... handle request
 * }
 */
export function validateEnvironmentSecrets(...keys: string[]): {
  valid: boolean;
  errors: Array<{ key: string; reason: string }>;
  warnings: Array<{ key: string; reason: string }>;
} {
  const errors: Array<{ key: string; reason: string }> = [];
  const warnings: Array<{ key: string; reason: string }> = [];

  // If specific keys provided, validate only those
  const keysToValidate = keys.length > 0 ? keys : Object.keys(SECRET_CONFIGS);

  for (const key of keysToValidate) {
    const config = SECRET_CONFIGS[key];
    const value = process.env[key];

    if (!config) {
      warnings.push({
        key,
        reason: 'Unknown secret configuration (not registered in SECRET_CONFIGS)',
      });
      continue;
    }

    // Check if required and present
    if (config.required && !value) {
      errors.push({
        key,
        reason: `Required environment variable missing: ${key}`,
      });
      continue;
    }

    // If present, validate format
    if (value) {
      if (value.length < config.minLength) {
        errors.push({
          key,
          reason: `${key} too short (${value.length} chars, min ${config.minLength})`,
        });
      }

      if (config.pattern && !config.pattern.test(value)) {
        errors.push({
          key,
          reason: `${key} does not match expected pattern: ${config.pattern.source}`,
        });
      }

      // Warn if secret appears to be a placeholder or test value
      if (/^(xxx|test|placeholder|change.?me|todo|demo)/i.test(value)) {
        warnings.push({
          key,
          reason: `${key} appears to be a placeholder value`,
        });
      }
    }
  }

  if (errors.length > 0) {
    console.error(
      '[SECURITY] Environment validation failed:',
      errors.map(e => `${e.key}: ${e.reason}`).join(', ')
    );

    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'Critical environment variables missing. Application cannot start.'
      );
    }
  }

  if (warnings.length > 0) {
    console.warn('[SECURITY] Environment warnings:', warnings);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * SAFE ACCESS: Get secret from environment with type safety
 * 
 * Provides a single point of access for secrets with logging/monitoring.
 * Never expose the actual secret value in logs.
 * 
 * @example
 * const dbUrl = getSecret('DATABASE_URL'); // Safe access
 * const stripeKey = getSecret('STRIPE_SECRET_KEY', SecretType.PAYMENT_KEY);
 */
export function getSecret(
  key: string,
  expectedType?: SecretType
): string | null {
  const value = process.env[key];

  if (!value) {
    return null;
  }

  const config = SECRET_CONFIGS[key];
  if (expectedType && config && config.type !== expectedType) {
    console.warn(
      `[SECURITY] Secret type mismatch: expected ${expectedType}, got ${config.type}`
    );
  }

  // Log that secret was accessed (not the value itself)
  logSecretAccess(key, expectedType || config?.type);

  return value;
}

/**
 * MONITORING: Log secret access for audit trail
 * 
 * Records when secrets are accessed (useful for detecting breaches).
 * Should integrate with your security monitoring system.
 * 
 * @internal
 */
function logSecretAccess(key: string, type?: SecretType): void {
  // In production, send to security monitoring system (e.g., Datadog, CloudWatch)
  if (process.env.NODE_ENV === 'production') {
    // Example: Send to monitoring service
    // await monitoringService.log({
    //   event: 'SECRET_ACCESS',
    //   key,
    //   type,
    //   timestamp: new Date().toISOString(),
    //   source: new Error().stack,
    // });
  }
}

/**
 * DETECTION: Scan code/strings for suspicious patterns that look like secrets
 * 
 * Used in pre-commit hooks and CI/CD to detect accidental commits.
 * WARNING: This is a heuristic detector, not foolproof.
 * 
 * Patterns detected:
 * - API keys (starts with sk_, pk_, etc.)
 * - JWT tokens
 * - Database URLs with embedded credentials
 * - AWS access keys
 * - Private keys (BEGIN RSA PRIVATE KEY, etc.)
 * - Email credentials
 * 
 * @example
 * const suspicious = scanForSecrets(fileContent);
 * if (suspicious.length > 0) {
 *   throw new Error(`Potential secrets detected in file: ${suspicious.join(', ')}`);
 * }
 */
export function scanForSecrets(content: string): Array<{
  type: string;
  match: string;
  line?: number;
}> {
  const findings: Array<{ type: string; match: string; line?: number }> = [];

  const patterns = [
    // API Keys
    {
      name: 'Stripe API Key',
      pattern: /sk_(?:live|test)_[\w]{20,}/g,
    },
    {
      name: 'Stripe Publishable Key',
      pattern: /pk_(?:live|test)_[\w]{20,}/g,
    },
    // AWS Access Keys
    {
      name: 'AWS Access Key ID',
      pattern: /AKIA[0-9A-Z]{16}/g,
    },
    // GitHub Token
    {
      name: 'GitHub Personal Access Token',
      pattern: /ghp_[\w]{36,}/g,
    },
    // Private Keys
    {
      name: 'Private Key',
      pattern: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/g,
    },
    // Database URLs with credentials
    {
      name: 'Database URL with credentials',
      pattern: /(?:postgres|mysql|mongodb)(?:\+\w+)?:\/\/[\w]+:[\w]+@/g,
    },
    // JWT tokens (often very long base64 strings with dots)
    {
      name: 'JWT Token',
      pattern: /eyJ[\w-]+\.eyJ[\w-]+\.[\w-]+/g,
    },
    // Generic API keys (env var assignment)
    {
      name: 'Potential API Key (env assignment)',
      pattern: /(?:API_KEY|SECRET_KEY|APIKEY|TOKEN|PASSWORD|PASSWD)\s*=\s*['"][\w{32,}]+['"]/gi,
    },
  ];

  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    for (const { name, pattern } of patterns) {
      const matches = line.matchAll(pattern);
      for (const match of matches) {
        findings.push({
          type: name,
          match: match[0].slice(0, 20) + '...', // Truncate for safety
          line: i + 1,
        });
      }
    }
  }

  return findings;
}

/**
 * OUTPUT: Generate .gitignore entries for secret files
 * 
 * Add these to your .gitignore to prevent accidental commits.
 * 
 * @example
 * const ignored = getGitignoreTemplate();
 * console.log(ignored);
 */
export function getGitignoreTemplate(): string {
  return `
# Environment variables — NEVER commit these
.env
.env.local
.env.*.local
.env.production.local

# Secrets and credentials
*.pem
*.key
*.keystore
*.p12
*.p8

# IDE secrets
.idea/credentials.xml
.vscode/settings.local.json

# Temporary test files with hardcoded values
test.secrets.json
test.env

# OS files (also include in gitignore)
.DS_Store
Thumbs.db

# Dependencies that might contain secrets
node_modules/
venv/
__pycache__/
`.trim();
}

/**
 * INITIALIZATION: Environment setup script for development
 * 
 * Developers should copy .env.example to .env.local and fill in actual values.
 * This template shows required and optional variables.
 */
export function getEnvTemplate(): string {
  return `
# ══════════════════════════════════════════════════════════════════════════════
# Environment Variables — StreamFinder v3
# ══════════════════════════════════════════════════════════════════════════════
# IMPORTANT: This file should NOT be committed to version control.
# For development: Copy this to .env.local and fill in your values.
# For production: Use your secret management system (AWS Secrets Manager, Vault, etc.)
# ══════════════════════════════════════════════════════════════════════════════

# ─── Application Core ───────────────────────────────────────────────────────
NODE_ENV=development
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# ─── Authentication (NextAuth) ──────────────────────────────────────────────
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here-min-32-characters-required

# ─── Database ──────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://user:password@localhost:5432/streamfinder

# ─── OAuth Providers (Optional) ────────────────────────────────────────────
# Google OAuth
# GOOGLE_CLIENT_ID=your-google-client-id
# GOOGLE_CLIENT_SECRET=your-google-client-secret

# GitHub OAuth
# GITHUB_CLIENT_ID=your-github-client-id
# GITHUB_CLIENT_SECRET=your-github-client-secret

# ─── Payment Gateways (Optional) ───────────────────────────────────────────
# Stripe
# STRIPE_SECRET_KEY=sk_test_your-key-here
# STRIPE_WEBHOOK_SECRET=whsec_test_your-key-here
# NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your-key-here

# Razorpay
# RAZORPAY_KEY_ID=your-key-id
# RAZORPAY_KEY_SECRET=your-key-secret

# ─── CAPTCHA (Optional) ────────────────────────────────────────────────────
# hCaptcha
# NEXT_PUBLIC_HCAPTCHA_SITE_KEY=your-site-key
# HCAPTCHA_SECRET_KEY=your-secret-key

# Cloudflare Turnstile
# NEXT_PUBLIC_TURNSTILE_SITE_KEY=your-site-key
# TURNSTILE_SECRET_KEY=your-secret-key

# ─── External APIs ────────────────────────────────────────────────────────
# TMDB (The Movie Database)
TMDB_API_KEY=your-tmdb-api-key

# ─── Redis (Optional, for rate limiting) ──────────────────────────────────
# UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
# UPSTASH_REDIS_REST_TOKEN=your-redis-token

# ─── Security & Admin ──────────────────────────────────────────────────────
ADMIN_IP_ALLOWLIST=127.0.0.1,192.168.1.100

# ─── Rate Limiting ────────────────────────────────────────────────────────
CAPTCHA_PROVIDER=hcaptcha

# ─── Logging & Monitoring (Optional) ──────────────────────────────────────
# SENTRY_DSN=your-sentry-dsn
# LOG_LEVEL=info
`.trim();
}

/**
 * SAFETY: Sanitize error messages to prevent secret leakage
 * 
 * Removes potentially sensitive information from error messages
 * before sending to clients or logging.
 * 
 * @example
 * try {
 *   connectToDatabase();
 * } catch (err) {
 *   const safe = sanitizeErrorMessage(err);
 *   res.status(500).json({ error: safe });
 * }
 */
export function sanitizeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  // Patterns to hide
  const patterns = [
    /password[=:]\s*[^\s&?;]+/gi,
    /api[_-]?key[=:]\s*[^\s&?;]+/gi,
    /secret[=:]\s*[^\s&?;]+/gi,
    /token[=:]\s*[^\s&?;]+/gi,
    /auth[=:]\s*[^\s&?;]+/gi,
    /\b[\w.-]+@[\w.-]+\b/g, // Email addresses
    /\d{13,}/g, // Long numbers (could be keys)
  ];

  let sanitized = message;
  for (const pattern of patterns) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }

  return sanitized;
}

export default {
  SecretType,
  validateEnvironmentSecrets,
  getSecret,
  scanForSecrets,
  getGitignoreTemplate,
  getEnvTemplate,
  sanitizeErrorMessage,
};
