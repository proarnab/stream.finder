// lib/sanitize.ts — Central input sanitization utilities
export function escapeHtml(str: unknown): string {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#x27;').replace(/\//g,'&#x2F;');
}
export function stripHtml(str: unknown): string {
  return String(str ?? '').replace(/<[^>]*>/g, '');
}
export function sanitizeUrl(url: unknown): string {
  const str = String(url ?? '').trim();
  if (!str) return '';
  try {
    const parsed = new URL(str);
    if (!['http:','https:','mailto:'].includes(parsed.protocol)) return '';
    return str;
  } catch {
    if (str.startsWith('/') && !str.startsWith('//')) return str;
    return '';
  }
}
export function clean(val: unknown, maxLen = 5000): string {
  return String(val ?? '').trim().slice(0, maxLen);
}
export function sanitizeEmail(email: unknown): string {
  return clean(email, 254).toLowerCase();
}
export function sanitizeSearchQuery(query: unknown): string {
  return clean(query, 500).replace(/[;<>|`$\\]/g, '').replace(/\x00/g, '');
}
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
export function sanitizeObject<T>(obj: T, depth = 0): T {
  if (depth > 20) throw new Error('Object too deeply nested');
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(item => sanitizeObject(item, depth + 1)) as unknown as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (DANGEROUS_KEYS.has(k)) continue;
    out[k] = sanitizeObject(v, depth + 1);
  }
  return out as T;
}
export function parseIntSafe(val: unknown): number | null {
  const n = parseInt(String(val ?? ''), 10);
  return isNaN(n) ? null : n;
}
