/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SQL & NoSQL INJECTION PROTECTION
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Protects against database injection attacks through:
 * 1. Input validation and sanitization
 * 2. Type-safe schema validation (Zod)
 * 3. Parameterized queries (Prisma ORM)
 * 4. Type casting and normalization
 * 5. Input length/pattern restrictions
 * 
 * THREAT MODELS:
 * SQL: SELECT * FROM users WHERE email='user@x.com' OR '1'='1'
 * NoSQL: { $ne: null }, { $where: "1==1" }, etc.
 * 
 * DEFENSE LAYERS:
 * 1. PRIMARY: Parameterized queries via Prisma (prevents SQL injection at DB level)
 * 2. SECONDARY: Zod schema validation (ensures type and format)
 * 3. TERTIARY: Input sanitization (removes suspicious patterns)
 * 4. QUATERNARY: Rate limiting + monitoring (detects attack patterns)
 */

import { z } from 'zod';
import { escapeHtml, clean } from '@/lib/sanitize';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LAYER 1: ZOD SCHEMAS — Type-Safe Input Validation
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Zod schemas provide:
 * - Type checking at runtime
 * - Format validation (email, URL, UUID, etc.)
 * - Length restrictions
 * - Custom validation rules
 * - Automatic sanitization/transformation
 * 
 * These schemas should be the FIRST point of validation for all user input.
 */

// ──── User & Authentication ────────────────────────────────────────────────

export const UserAuthSchema = z.object({
  email: z
    .string()
    .email('Invalid email format')
    .max(254, 'Email too long')
    .toLowerCase()
    .transform(e => e.trim()),

  password: z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .max(128, 'Password too long')
    // Ensure password has mix of character types
    .refine(/[A-Z]/.test, 'Password must contain uppercase letters')
    .refine(/[a-z]/.test, 'Password must contain lowercase letters')
    .refine(/[0-9]/.test, 'Password must contain numbers')
    .refine(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test, 'Password must contain special characters'),

  name: z
    .string()
    .min(2, 'Name too short')
    .max(100, 'Name too long')
    .transform(n => n.trim())
    .refine(n => /^[a-zA-Z\s'-]+$/.test(n), 'Name contains invalid characters'),
});

// ──── Search & Queries ────────────────────────────────────────────────────

export const SearchQuerySchema = z.object({
  q: z
    .string()
    .min(1, 'Query cannot be empty')
    .max(500, 'Query too long')
    .transform(q => q.trim())
    // Prevent dangerous characters that might indicate injection attempts
    .refine(
      q => !/[;<>|`$\\{}[\]()]/g.test(q),
      'Query contains invalid characters'
    ),

  limit: z
    .number()
    .int('Limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit cannot exceed 100')
    .default(20),

  offset: z
    .number()
    .int('Offset must be an integer')
    .min(0, 'Offset cannot be negative')
    .max(10000, 'Offset too large')
    .default(0),

  sortBy: z
    .enum(['title', 'rating', 'releaseDate', 'popularity'])
    .default('title'),

  sortOrder: z
    .enum(['asc', 'desc'])
    .default('asc'),
});

// ──── Movie/Content ────────────────────────────────────────────────────────

export const MovieIdSchema = z.object({
  movieId: z
    .string()
    .min(1, 'Movie ID required')
    .max(20, 'Movie ID too long')
    .refine(/^\d+$/, 'Movie ID must be numeric'),
});

export const ReviewSchema = z.object({
  movieId: z
    .string()
    .min(1)
    .max(20)
    .refine(/^\d+$/, 'Invalid movie ID'),

  rating: z
    .number()
    .min(1, 'Rating must be at least 1')
    .max(10, 'Rating cannot exceed 10'),

  title: z
    .string()
    .min(5, 'Title too short')
    .max(200, 'Title too long')
    .transform(t => t.trim()),

  content: z
    .string()
    .min(10, 'Review too short')
    .max(5000, 'Review too long')
    .transform(c => c.trim()),

  spoilers: z.boolean().default(false),
});

// ──── Watchlist ────────────────────────────────────────────────────────────

export const WatchlistItemSchema = z.object({
  movieId: z
    .string()
    .min(1)
    .max(20)
    .refine(/^\d+$/, 'Invalid movie ID'),

  status: z
    .enum(['PLAN_TO_WATCH', 'WATCHING', 'WATCHED', 'ABANDONED'])
    .default('PLAN_TO_WATCH'),
});

// ──── User Profile ────────────────────────────────────────────────────────

export const UserProfileSchema = z.object({
  displayName: z
    .string()
    .min(2, 'Display name too short')
    .max(100, 'Display name too long')
    .transform(d => d.trim())
    .optional(),

  bio: z
    .string()
    .max(500, 'Bio too long')
    .transform(b => b.trim())
    .optional(),

  website: z
    .string()
    .url('Invalid URL')
    .max(2048, 'URL too long')
    .optional()
    .or(z.literal('')),

  country: z
    .string()
    .min(2, 'Country code too short')
    .max(2, 'Country code too long')
    .regex(/^[A-Z]{2}$/, 'Invalid country code')
    .optional(),

  preferredCurrency: z
    .enum(['USD', 'INR', 'EUR', 'GBP'])
    .default('USD'),
});

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LAYER 2: Input Transformation & Casting
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Normalize and cast user input to ensure type safety before database operations.
 */

/**
 * Cast and validate numeric ID (for database lookups)
 * 
 * Ensures ID is valid before passing to Prisma to prevent:
 * - Injection via ID parameter
 * - Type confusion
 * - Out-of-range values
 * 
 * @example
 * const movieId = castAndValidateId(req.query.id);
 * const movie = await prisma.movie.findUnique({
 *   where: { id: movieId }
 * });
 */
export function castAndValidateId(
  id: unknown,
  options: { min?: number; max?: number } = {}
): number {
  const { min = 1, max = 999_999_999 } = options;

  const parsed = parseInt(String(id ?? ''), 10);

  if (isNaN(parsed)) {
    throw new Error(`Invalid ID: not a number`);
  }

  if (parsed < min || parsed > max) {
    throw new Error(`ID out of range: ${parsed}`);
  }

  return parsed;
}

/**
 * Cast and validate string for database query
 * 
 * Ensures string is properly typed and within length limits.
 * Does NOT sanitize for HTML (database stores raw values).
 * 
 * @example
 * const email = castAndValidateString(req.body.email, {
 *   maxLength: 254,
 *   pattern: /^[^@]+@[^@]+$/ // Basic email pattern
 * });
 */
export function castAndValidateString(
  value: unknown,
  options: {
    maxLength?: number;
    minLength?: number;
    pattern?: RegExp;
    allowEmpty?: boolean;
  } = {}
): string {
  const { maxLength = 5000, minLength = 0, pattern, allowEmpty = false } = options;

  const str = String(value ?? '').trim();

  if (!allowEmpty && str.length === 0) {
    throw new Error('String cannot be empty');
  }

  if (str.length > maxLength) {
    throw new Error(`String exceeds maximum length (${str.length}/${maxLength})`);
  }

  if (str.length < minLength) {
    throw new Error(`String below minimum length (${str.length}/${minLength})`);
  }

  if (pattern && !pattern.test(str)) {
    throw new Error(`String does not match required pattern`);
  }

  return str;
}

/**
 * Cast and validate array (for bulk operations)
 * 
 * Ensures array:
 * - Is actually an array
 * - Doesn't exceed max items
 * - Contains validated items
 * 
 * Used for bulk insert/update operations.
 * 
 * @example
 * const ids = castAndValidateArray(req.body.movieIds, {
 *   maxItems: 100,
 *   itemValidator: castAndValidateId
 * });
 */
export function castAndValidateArray<T>(
  value: unknown,
  options: {
    maxItems?: number;
    itemValidator?: (item: unknown) => T;
  } = {}
): T[] {
  const { maxItems = 1000, itemValidator } = options;

  if (!Array.isArray(value)) {
    throw new Error('Expected array');
  }

  if (value.length > maxItems) {
    throw new Error(`Array exceeds maximum items (${value.length}/${maxItems})`);
  }

  if (itemValidator) {
    return value.map(item => itemValidator(item));
  }

  return value as T[];
}

/**
 * Cast and validate object (for create/update operations)
 * 
 * Ensures object:
 * - Is actually an object
 * - Doesn't have excessive properties
 * - Contains only whitelisted keys
 * 
 * @example
 * const userData = castAndValidateObject(req.body, {
 *   allowedKeys: ['name', 'email', 'bio'],
 *   maxKeys: 10
 * });
 */
export function castAndValidateObject(
  value: unknown,
  options: { allowedKeys?: string[]; maxKeys?: number } = {}
): Record<string, unknown> {
  const { allowedKeys, maxKeys = 100 } = options;

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Expected object');
  }

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj);

  if (keys.length > maxKeys) {
    throw new Error(`Object has too many properties (${keys.length}/${maxKeys})`);
  }

  if (allowedKeys) {
    for (const key of keys) {
      if (!allowedKeys.includes(key)) {
        throw new Error(`Unexpected property: ${key}`);
      }
    }
  }

  return obj;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LAYER 3: Parametrized Query Helpers (Prisma Safe Patterns)
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Prisma automatically uses parameterized queries, but these helpers
 * ensure proper usage patterns and validate data before passing to Prisma.
 */

/**
 * SAFE PATTERN: Validated unique lookup by ID
 * 
 * @example
 * const user = await findUserById(userId, prisma);
 */
export async function findUserById(
  id: string,
  prisma: any // Prisma client
) {
  const validId = castAndValidateId(id);
  return prisma.user.findUnique({
    where: { id: String(validId) },
  });
}

/**
 * SAFE PATTERN: Validated search with limit
 * 
 * @example
 * const results = await searchMovies({
 *   query: req.body.q,
 *   limit: 20,
 *   offset: 0
 * }, prisma);
 */
export async function searchMovies(
  params: unknown,
  prisma: any
) {
  const validated = SearchQuerySchema.parse(params);

  return prisma.movie.findMany({
    where: {
      OR: [
        { title: { contains: validated.q, mode: 'insensitive' } },
        { description: { contains: validated.q, mode: 'insensitive' } },
      ],
    },
    skip: validated.offset,
    take: validated.limit,
    orderBy: { [validated.sortBy]: validated.sortOrder },
  });
}

/**
 * SAFE PATTERN: Validated bulk insert
 * 
 * @example
 * await bulkInsertReviews(reviews, prisma);
 */
export async function bulkInsertReviews(
  items: unknown[],
  prisma: any
) {
  const validated = castAndValidateArray(items, {
    maxItems: 100,
    itemValidator: (item) => ReviewSchema.parse(item),
  });

  return prisma.review.createMany({
    data: validated,
    skipDuplicates: true,
  });
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LAYER 4: Dangerous Pattern Detection
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Defense-in-depth: Detect common injection patterns.
 * NOTE: This is supplementary to parameterized queries, not a replacement.
 */

/**
 * Suspicious SQL patterns that might indicate injection attempts
 */
const SUSPICIOUS_SQL_PATTERNS = [
  /(\b(UNION|SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|SCRIPT|JAVASCRIPT)\b)/i,
  /(-{2}|\/\*|\*\/|;)/,           // SQL comments and statement separators
  /(\bOR\b.*=.*|AND.*1\s*=\s*1)/i, // OR 1=1, AND 1=1 patterns
  /(\b(UNION|ALL)\s+(SELECT|ALL))/i,
];

/**
 * Suspicious NoSQL patterns
 */
const SUSPICIOUS_NOSQL_PATTERNS = [
  /\$where/,                       // MongoDB $where operator
  /\$ne:\s*null/,                  // MongoDB $ne: null
  /\{[\s\S]*\$regex[\s\S]*\}/,     // MongoDB regex injection
  /\.find\s*\(/,                   // Direct find calls
];

/**
 * DETECTION: Check if input contains suspicious SQL patterns
 * 
 * @example
 * if (isSuspiciousSQLInput(userSearchQuery)) {
 *   throw new Error('Suspicious input detected');
 * }
 */
export function isSuspiciousSQLInput(input: unknown): boolean {
  const str = String(input ?? '').toUpperCase();
  return SUSPICIOUS_SQL_PATTERNS.some(pattern => pattern.test(str));
}

/**
 * DETECTION: Check if input contains suspicious NoSQL patterns
 * 
 * @example
 * if (isSuspiciousNoSQLInput(userFilter)) {
 *   throw new Error('Suspicious input detected');
 * }
 */
export function isSuspiciousNoSQLInput(input: unknown): boolean {
  const str = JSON.stringify(input ?? '');
  return SUSPICIOUS_NOSQL_PATTERNS.some(pattern => pattern.test(str));
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * USAGE EXAMPLES FOR API ROUTES
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * // Example: Safe search endpoint
 * export async function GET(req: NextRequest) {
 *   const { searchParams } = new URL(req.url);
 *   
 *   try {
 *     // Validate with Zod schema
 *     const query = SearchQuerySchema.parse({
 *       q: searchParams.get('q'),
 *       limit: parseInt(searchParams.get('limit') || '20'),
 *       offset: parseInt(searchParams.get('offset') || '0'),
 *     });
 *     
 *     // Check for suspicious patterns (defense-in-depth)
 *     if (isSuspiciousSQLInput(query.q)) {
 *       throw new Error('Invalid search query');
 *     }
 *     
 *     // Query database with validated input
 *     const results = await searchMovies(query, prisma);
 *     
 *     return NextResponse.json(results);
 *   } catch (err) {
 *     // Return generic error (don't leak schema details)
 *     return NextResponse.json(
 *       { error: 'Invalid request' },
 *       { status: 400 }
 *     );
 *   }
 * }
 */

export default {
  // Schemas
  UserAuthSchema,
  SearchQuerySchema,
  MovieIdSchema,
  ReviewSchema,
  WatchlistItemSchema,
  UserProfileSchema,

  // Type casting
  castAndValidateId,
  castAndValidateString,
  castAndValidateArray,
  castAndValidateObject,

  // Query helpers
  findUserById,
  searchMovies,
  bulkInsertReviews,

  // Detection
  isSuspiciousSQLInput,
  isSuspiciousNoSQLInput,
};
