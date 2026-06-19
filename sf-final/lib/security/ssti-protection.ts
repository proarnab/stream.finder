/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SERVER-SIDE TEMPLATE INJECTION (SSTI) PROTECTION
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Protects against malicious template syntax injection by:
 * 1. Using Next.js built-in JSX (inherently safe)
 * 2. Sanitizing dynamic content before rendering
 * 3. Disabling dangerous template features
 * 4. Validating template variables at runtime
 * 
 * THREAT MODEL: Attacker injects template syntax like {{ 7 * 7 }}, 
 * <%= process.env.DB_PASSWORD %>, or <% import('fs').unlink() %>
 * 
 * DEFENSE MECHANISMS:
 * - Type-safe JSX prevents template injection (TypeScript compilation)
 * - Content escaping sanitizes all dynamic data
 * - Variable whitelist prevents __proto__ and constructor access
 * - No eval() or Function() constructors used
 */

import { escapeHtml, sanitizeObject } from '@/lib/sanitize';

/**
 * Whitelisted template variables — only these keys are allowed
 * This prevents object injection attacks targeting __proto__, constructor, etc.
 */
export interface SafeTemplateContext {
  title?: string;
  description?: string;
  imageUrl?: string;
  author?: string;
  rating?: number;
  releaseDate?: string;
  genre?: string[];
  language?: string;
  country?: string;
  duration?: number;
}

/**
 * Strict template context validator
 * 
 * Ensures only whitelisted properties are present in template context,
 * preventing prototype pollution and arbitrary property injection.
 * 
 * @example
 * const context = validateTemplateContext({
 *   title: 'Inception',
 *   description: 'A mind-bending thriller',
 *   __proto__: { isAdmin: true }, // REJECTED
 *   constructor: {}, // REJECTED
 * });
 */
export function validateTemplateContext(
  data: unknown
): SafeTemplateContext {
  if (!data || typeof data !== 'object') {
    return {};
  }

  const obj = data as Record<string, unknown>;
  const context: SafeTemplateContext = {};

  // WHITELIST APPROACH: Only allow known, safe properties
  const allowedKeys: (keyof SafeTemplateContext)[] = [
    'title', 'description', 'imageUrl', 'author', 'rating',
    'releaseDate', 'genre', 'language', 'country', 'duration'
  ];

  for (const key of allowedKeys) {
    const value = obj[key];
    if (value === undefined || value === null) continue;

    // Type validation per property
    switch (key) {
      case 'title':
      case 'description':
      case 'imageUrl':
      case 'author':
      case 'releaseDate':
      case 'language':
      case 'country':
        // String properties — escape and limit length
        context[key] = escapeHtml(value).slice(0, 500);
        break;
      case 'rating':
        // Number property — validate range
        const num = Number(value);
        context[key] = (isNaN(num) || num < 0 || num > 10) ? undefined : num;
        break;
      case 'genre':
      case 'genre':
        // Array of strings — validate each element
        if (Array.isArray(value)) {
          context[key] = value
            .filter(item => typeof item === 'string')
            .map(item => escapeHtml(item).slice(0, 50))
            .slice(0, 20); // Max 20 genres
        }
        break;
      case 'duration':
        // Number property — validate range (minutes, max 999)
        const dur = Number(value);
        context[key] = (isNaN(dur) || dur < 0 || dur > 999) ? undefined : dur;
        break;
    }
  }

  return context;
}

/**
 * Safe template rendering helper for common metadata patterns
 * 
 * Use this when generating dynamic HTML head tags, OG meta tags, or
 * similar content. All values are HTML-escaped to prevent injection.
 * 
 * @example
 * const meta = renderSafeMetaTags({
 *   title: movie.title,
 *   description: movie.synopsis,
 *   imageUrl: movie.posterUrl,
 * });
 * // Output: Safe HTML strings ready for insertion into <head>
 */
export function renderSafeMetaTags(context: SafeTemplateContext): {
  title: string;
  description: string;
  imageUrl: string;
  markup: string;
} {
  const safe = validateTemplateContext(context);

  const title = safe.title || 'StreamFinder';
  const description = safe.description || 'Discover movies and shows';
  const imageUrl = safe.imageUrl || 'https://example.com/default.jpg';

  // Generate Open Graph meta tags with properly escaped values
  const markup = `
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:image" content="${escapeHtml(imageUrl)}" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(imageUrl)}" />
    <meta name="description" content="${escapeHtml(description)}" />
  `;

  return { title, description, imageUrl, markup };
}

/**
 * Safe template variable extraction for use in JSX components
 * 
 * Provides type-safe access to template variables in React components,
 * eliminating the possibility of template injection since we're using JSX
 * (not a template engine).
 * 
 * @example
 * const vars = extractTemplateVars(movie);
 * return (
 *   <div>
 *     <h1>{vars.title}</h1>
 *     <p>{vars.description}</p>
 *   </div>
 * );
 */
export function extractTemplateVars(data: unknown): SafeTemplateContext {
  return validateTemplateContext(data);
}

/**
 * VALIDATION: Ensure no dangerous template expressions in user input
 * 
 * Detects common SSTI patterns and rejects suspicious content
 * This is a defense-in-depth check (primary defense is escaping).
 * 
 * Patterns detected:
 * - Handlebars: {{ }} or {{{ }}}
 * - ERB: <%= %>, <% %>
 * - Jinja: {% %}, {{ }}
 * - Freemarker: <#, [#, ${
 * - Velocity: ${}
 * - Expression language: ${}
 */
export function isSSTISuspicious(input: unknown): boolean {
  const str = String(input ?? '').trim();

  // Suspicious SSTI patterns
  const patterns = [
    /\{\{.*?\}\}/,           // Handlebars/Mustache {{ }}
    /\{%.*?%\}/,             // Jinja/Django {% %}
    /<%[\s\S]*?%>/,          // ERB <% %>
    /<#[\s\S]*?>/,           // Freemarker
    /\[\#[\s\S]*?\]/,        // Freemarker alt
    /\$\{[\s\S]*?\}/,        // Expression language ${} or Velocity
    /\*\{[\s\S]*?\}\*/,      // Velocity alt
    /`[\s\S]*?\$\{[\s\S]*?\}`/, // Template literals with injection
  ];

  return patterns.some(p => p.test(str));
}

/**
 * SAFETY: Assert that template content is safe for rendering
 * 
 * Throws if SSTI-suspicious content is detected. Use this as a guard
 * before passing user input to template engines (if you use them).
 */
export function assertNoSSTI(input: unknown, label = 'input'): void {
  if (isSSTISuspicious(input)) {
    throw new Error(
      `[SSTI] Suspicious template syntax detected in ${label}. ` +
      `This may be a template injection attack.`
    );
  }
}

/**
 * REACT COMPONENT SAFETY: Safe data wrapper for JSX
 * 
 * Ensures data passed to React components is sanitized and type-safe.
 * Use this pattern when rendering dynamic content in components.
 * 
 * @example
 * export function MovieCard(props: { movie: unknown }) {
 *   const safe = makeSafeForComponent(props.movie);
 *   return <h1>{safe.title}</h1>;
 * }
 */
export function makeSafeForComponent<T>(data: unknown): T {
  // Sanitize against prototype pollution
  const sanitized = sanitizeObject(data);
  return sanitized as T;
}

/**
 * CONFIGURATION: Auto-escaping behavior for template-like strings
 * 
 * Best practice: When you absolutely must work with template-like strings
 * (e.g., rendering Markdown, email templates), always escape output.
 */
export const SSTI_SAFE_CONFIG = {
  // Disable all dynamic code execution
  allowEval: false,
  allowFunctionConstructor: false,
  
  // Auto-escape all output
  autoEscape: true,
  
  // Escape HTML special characters
  escapeHtml: true,
  
  // Prevent property access patterns
  allowPropertiesAccess: false,
  
  // Max template complexity to prevent ReDoS-like attacks
  maxTemplateDepth: 5,
  maxExpressionLength: 1000,
} as const;

/**
 * NEXT.JS SPECIFIC: Safe getServerSideProps/getStaticProps data handling
 * 
 * Use this when passing data from server-side functions to components.
 * Ensures all data is properly typed and sanitized.
 */
export function createSafePageProps<T extends Record<string, unknown>>(
  data: T
): T {
  // Validate each property
  const safe = Object.entries(data).reduce((acc, [key, value]) => {
    if (value === null || value === undefined) {
      acc[key] = value;
    } else if (typeof value === 'string') {
      acc[key] = escapeHtml(value);
    } else if (typeof value === 'object') {
      acc[key] = sanitizeObject(value);
    } else {
      acc[key] = value;
    }
    return acc;
  }, {} as Record<string, unknown>);

  return safe as T;
}

export default {
  validateTemplateContext,
  renderSafeMetaTags,
  extractTemplateVars,
  isSSTISuspicious,
  assertNoSSTI,
  makeSafeForComponent,
  createSafePageProps,
  SSTI_SAFE_CONFIG,
};
