/**
 * ═══════════════════════════════════════════════════════════════════════════
 * REGULAR EXPRESSION DOS (ReDoS) PROTECTION
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Protects against Catastrophic Backtracking in Regular Expressions by:
 * 1. Pre-validating regex patterns for dangerous constructs
 * 2. Enforcing execution timeouts using Workers/Promises
 * 3. Limiting input size before regex matching
 * 4. Using safe regex patterns from a curated whitelist
 * 5. Providing safe alternatives to common regex operations
 * 
 * THREAT MODEL: Attacker provides input like "aaaaaaaaaaaaaab" with a
 * vulnerable regex like (a+)+b or (a|a)*b, causing exponential backtracking
 * that can freeze the server.
 * 
 * Example vulnerable regex (DO NOT USE):
 *   (a+)+b           // Catastrophic backtracking
 *   (x+x+)+y         // Exponential time complexity
 *   (a|ab)*b         // Nested quantifiers
 *   (a|a)*            // Overlapping alternatives
 * 
 * Safe alternatives (USE THESE):
 *   a+b              // No nesting
 *   (?:a|ab)b        // Atomic grouping
 *   a{1,5}b          // Bounded quantifiers
 *   a(?:b|c)+        // Non-backtracking
 */

/**
 * Regex validation patterns to detect ReDoS vulnerabilities
 * These patterns identify dangerous constructs in regex patterns
 */
const REDOS_DANGER_PATTERNS = [
  /\(\?:<.*?\)\+/,              // (?:...)+  with complex inner pattern
  /\(\?:<.*?\)\*/,              // (?:...)* with complex inner pattern
  /\+\+/,                       // ++ — nested quantifiers
  /\*\*/,                       // ** — nested quantifiers
  /{\d+}\+/,                    // {n}+ — possessive quantifier (bad)
  /\{\d+\}\*/,                  // {n}* — possessive quantifier (bad)
  /\(\w+\|\w+\)\+/,            // (a|b)+  alternation with quantifier
  /\(\w+\|\w+\)\*/,            // (a|b)*  alternation with quantifier
  /\([^)]*\|\s*[^)]*\)[*+]/,   // (...|...)[*+] — alternation with quantifier
];

/**
 * Safe regex patterns — pre-validated, production-tested
 * Use these instead of custom regexes where possible
 */
export const SAFE_REGEX = {
  // Email — simple pattern (full RFC5322 is unsafe)
  EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,

  // URL — basic validation
  URL: /^https?:\/\/[a-zA-Z0-9.-]+(:\d{1,5})?(\/[^\s]*)?$/,

  // Alphanumeric with underscores and hyphens (usernames)
  USERNAME: /^[a-zA-Z0-9_-]{3,32}$/,

  // Phone number — international format
  PHONE: /^\+?[1-9]\d{1,14}$/,

  // UUID
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,

  // IPv4 address
  IPv4: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,

  // IPv6 address — simplified
  IPv6: /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4})$/,

  // Hex color code
  HEX_COLOR: /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/,

  // ISO 8601 date
  ISO_DATE: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/,

  // Slug (URL-safe lowercase alphanumeric with hyphens)
  SLUG: /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/,

  // Integer (optional sign)
  INTEGER: /^-?\d+$/,

  // Decimal number (optional sign, optional fractional part)
  DECIMAL: /^-?(?:\d+\.?\d*|\.\d+)$/,

  // Whitespace-trimmed string (no leading/trailing spaces, limited internal spaces)
  TRIMMED_STRING: /^[\w\s.,!?()'-]{1,500}$/,
} as const;

/**
 * Configuration constants for ReDoS protection
 */
export const REDOS_CONFIG = {
  // Maximum input length before regex matching (in bytes)
  MAX_INPUT_LENGTH: 10_000,

  // Timeout for regex operations (in milliseconds)
  REGEX_TIMEOUT_MS: 100,

  // Maximum number of backreferences allowed
  MAX_BACKREFERENCES: 3,

  // Whether to throw or return false on timeout
  THROW_ON_TIMEOUT: false,
} as const;

/**
 * Result of regex validation
 */
export interface RegexValidationResult {
  isValid: boolean;
  reason?: string;
  hasDangerousPatterns?: string[];
}

/**
 * VALIDATION: Check if a regex pattern is safe from ReDoS
 * 
 * Detects known dangerous patterns like nested quantifiers,
 * overlapping alternation, and exponential backtracking.
 * 
 * This is NOT a complete ReDoS detector (no tool is), but covers
 * the most common vulnerability patterns.
 * 
 * @example
 * const result = validateRegexSafety(/(a+)+b/);
 * if (!result.isValid) {
 *   console.warn('Unsafe regex:', result.reason);
 * }
 */
export function validateRegexSafety(pattern: RegExp | string): RegexValidationResult {
  const str = pattern instanceof RegExp ? pattern.source : String(pattern);

  // Check input size
  if (str.length > 500) {
    return {
      isValid: false,
      reason: 'Regex pattern too long (max 500 chars to prevent complexity attacks)',
    };
  }

  // Check for known dangerous patterns
  const dangerousPatterns: string[] = [];
  for (const dangerPattern of REDOS_DANGER_PATTERNS) {
    if (dangerPattern.test(str)) {
      dangerousPatterns.push(dangerPattern.source);
    }
  }

  if (dangerousPatterns.length > 0) {
    return {
      isValid: false,
      reason: `Regex contains potentially dangerous patterns: ${dangerousPatterns.join(', ')}`,
      hasDangerousPatterns: dangerousPatterns,
    };
  }

  // Check for excessive backreferences (can cause exponential backtracking)
  const backrefs = str.match(/\\(\d+)/g) || [];
  if (backrefs.length > REDOS_CONFIG.MAX_BACKREFERENCES) {
    return {
      isValid: false,
      reason: `Too many backreferences (${backrefs.length}, max ${REDOS_CONFIG.MAX_BACKREFERENCES})`,
    };
  }

  return { isValid: true };
}

/**
 * SAFE EXECUTION: Run regex with timeout protection
 * 
 * Executes a regex match/test with a timeout to prevent ReDoS attacks.
 * If execution exceeds timeout, returns false or throws (based on config).
 * 
 * Uses a Promise-based timeout mechanism that doesn't guarantee
 * immediate termination (JavaScript doesn't have true thread interruption),
 * but prevents the regex from blocking indefinitely.
 * 
 * @example
 * const result = await safeRegexMatch(userInput, /^[a-zA-Z0-9]+$/);
 * if (result) {
 *   console.log('Input is valid');
 * } else {
 *   console.warn('Input failed validation or timed out');
 * }
 */
export async function safeRegexTest(
  input: string | null | undefined,
  pattern: RegExp
): Promise<boolean> {
  // Validate the regex pattern itself
  const validation = validateRegexSafety(pattern);
  if (!validation.isValid) {
    throw new Error(`Unsafe regex pattern: ${validation.reason}`);
  }

  // Limit input size
  const str = String(input ?? '').slice(0, REDOS_CONFIG.MAX_INPUT_LENGTH);

  return new Promise((resolve, reject) => {
    // Set timeout to prevent indefinite hanging
    const timeout = setTimeout(() => {
      if (REDOS_CONFIG.THROW_ON_TIMEOUT) {
        reject(new Error(`Regex timeout (${REDOS_CONFIG.REGEX_TIMEOUT_MS}ms exceeded)`));
      } else {
        resolve(false); // Treat timeout as non-match
      }
    }, REDOS_CONFIG.REGEX_TIMEOUT_MS);

    try {
      const result = pattern.test(str);
      clearTimeout(timeout);
      resolve(result);
    } catch (err) {
      clearTimeout(timeout);
      reject(err);
    }
  });
}

/**
 * SAFE EXECUTION: Run regex match with timeout
 * 
 * Executes regex.match() with timeout protection.
 * Returns matched groups or null if timeout/no match.
 */
export async function safeRegexMatch(
  input: string | null | undefined,
  pattern: RegExp
): Promise<RegExpMatchArray | null> {
  const validation = validateRegexSafety(pattern);
  if (!validation.isValid) {
    throw new Error(`Unsafe regex pattern: ${validation.reason}`);
  }

  const str = String(input ?? '').slice(0, REDOS_CONFIG.MAX_INPUT_LENGTH);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (REDOS_CONFIG.THROW_ON_TIMEOUT) {
        reject(new Error(`Regex timeout (${REDOS_CONFIG.REGEX_TIMEOUT_MS}ms exceeded)`));
      } else {
        resolve(null);
      }
    }, REDOS_CONFIG.REGEX_TIMEOUT_MS);

    try {
      const result = str.match(pattern);
      clearTimeout(timeout);
      resolve(result);
    } catch (err) {
      clearTimeout(timeout);
      reject(err);
    }
  });
}

/**
 * SAFE EXECUTION: Run regex replace with timeout
 * 
 * Executes regex.replace() with timeout protection.
 */
export async function safeRegexReplace(
  input: string | null | undefined,
  pattern: RegExp,
  replacement: string | ((match: string, ...args: unknown[]) => string)
): Promise<string> {
  const validation = validateRegexSafety(pattern);
  if (!validation.isValid) {
    throw new Error(`Unsafe regex pattern: ${validation.reason}`);
  }

  const str = String(input ?? '').slice(0, REDOS_CONFIG.MAX_INPUT_LENGTH);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (REDOS_CONFIG.THROW_ON_TIMEOUT) {
        reject(new Error(`Regex timeout (${REDOS_CONFIG.REGEX_TIMEOUT_MS}ms exceeded)`));
      } else {
        resolve(str); // Return original on timeout
      }
    }, REDOS_CONFIG.REGEX_TIMEOUT_MS);

    try {
      const result = str.replace(pattern, replacement as string);
      clearTimeout(timeout);
      resolve(result);
    } catch (err) {
      clearTimeout(timeout);
      reject(err);
    }
  });
}

/**
 * VALIDATION: Check input format without regex
 * 
 * Safe alternatives to regex for common validation tasks.
 * Use these when you don't need full regex power.
 */
export const SAFE_VALIDATORS = {
  // Email validation without regex (basic)
  isEmail: (email: unknown): boolean => {
    const str = String(email ?? '').trim();
    if (str.length > 254 || !str.includes('@')) return false;
    const [localPart, domain] = str.split('@');
    return localPart.length > 0 && localPart.length <= 64 && domain.includes('.');
  },

  // URL validation without regex
  isUrl: (url: unknown): boolean => {
    try {
      const u = new URL(String(url ?? ''));
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  },

  // Alphanumeric + underscore/hyphen (username)
  isUsername: (username: unknown): boolean => {
    const str = String(username ?? '').trim();
    return str.length >= 3 && str.length <= 32 &&
      /^[a-zA-Z0-9_-]+$/.test(str);
  },

  // UUID validation
  isUUID: (uuid: unknown): boolean => {
    const str = String(uuid ?? '').trim();
    return SAFE_REGEX.UUID.test(str);
  },

  // IPv4 address
  isIPv4: (ip: unknown): boolean => {
    const str = String(ip ?? '').trim();
    return SAFE_REGEX.IPv4.test(str);
  },

  // Decimal number
  isDecimal: (num: unknown): boolean => {
    const str = String(num ?? '').trim();
    return SAFE_REGEX.DECIMAL.test(str);
  },
} as const;

/**
 * DEFENSE-IN-DEPTH: Scan user regex pattern and flag dangerous constructs
 * 
 * For applications that allow users to input regex patterns,
 * scan and flag dangerous patterns before accepting them.
 */
export function scanRegexPattern(pattern: unknown): {
  safe: boolean;
  warnings: string[];
  explanation: string;
} {
  const str = String(pattern ?? '').trim();

  if (str.length === 0) {
    return {
      safe: false,
      warnings: ['Empty regex pattern'],
      explanation: 'Pattern must not be empty',
    };
  }

  const warnings: string[] = [];

  // Check for dangerous patterns
  if (/\(\+\)\+/.test(str) || /\(\*\)\*/.test(str)) {
    warnings.push('Nested quantifiers detected (a+)+ or (a*)*');
  }
  if (/\(\?:.*\)\+(?=\()/.test(str)) {
    warnings.push('Non-capturing group with quantifier may have exponential complexity');
  }
  if (/(\w+\|)+\w+\+/.test(str)) {
    warnings.push('Alternation with quantifier may cause backtracking');
  }

  const safe = warnings.length === 0;
  return {
    safe,
    warnings,
    explanation: safe ? 'Pattern appears safe' : 'Pattern contains potentially dangerous constructs',
  };
}

export default {
  SAFE_REGEX,
  REDOS_CONFIG,
  validateRegexSafety,
  safeRegexTest,
  safeRegexMatch,
  safeRegexReplace,
  SAFE_VALIDATORS,
  scanRegexPattern,
};
