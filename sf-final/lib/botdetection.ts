// lib/botdetection.ts
// Detects common bots, scrapers, and automated tools
// Uses user-agent analysis + behavioral signals

import { NextRequest } from 'next/server';
import { getClientIP } from './ratelimit';

export interface BotDetectionResult {
  isBot: boolean;
  confidence: number;        // 0.0–1.0
  reason?: string;
  category?: 'scraper' | 'crawler' | 'headless' | 'api-client' | 'suspicious';
}

// ─── Suspicious User-Agent patterns ───────────────────────────────────────────

const BOT_USER_AGENTS = [
  // Scrapers
  /scrapy/i,
  /curl/i,
  /wget/i,
  /python-requests/i,
  /httplib2/i,
  /perl/i,
  /ruby/i,
  /java(?!script)/i,
  /node-fetch/i,
  /axios/i,
  /okhttp/i,

  // Headless browsers
  /headless/i,
  /phantomjs/i,
  /puppeteer/i,
  /playwright/i,
  /headless\s+chrome/i,

  // Search engine crawlers (usually ok to allow)
  /googlebot/i,
  /bingbot/i,
  /yandexbot/i,
  /baiduspider/i,
  /applebot/i,

  // Security scanners
  /nmap/i,
  /nikto/i,
  /burpsuite/i,
  /metasploit/i,
  /sqlmap/i,
  /nessus/i,

  // Monitoring/analytics
  /datadog/i,
  /newrelic/i,
  /pingdom/i,
  /uptimerobot/i,
];

const ALLOWED_BOTS = [
  /googlebot/i,
  /bingbot/i,
  /yandexbot/i,
  /baiduspider/i,
  /applebot/i,
  /duckduckbot/i,
];

// ─── Main detection function ──────────────────────────────────────────────────

export function detectBot(req: NextRequest): BotDetectionResult {
  const userAgent = req.headers.get('user-agent') ?? '';
  const ip = getClientIP(req);

  let confidence = 0;
  let reason = '';
  let category: BotDetectionResult['category'];

  // Check 1: User-Agent analysis
  const userAgentScore = analyzeUserAgent(userAgent);
  if (userAgentScore.score > 0) {
    confidence += userAgentScore.score;
    reason = userAgentScore.reason;
    category = userAgentScore.category;
  }

  // Check 2: Missing typical browser headers
  const headerScore = analyzeBrowserHeaders(req);
  if (headerScore > 0) {
    confidence += headerScore;
    if (!reason) reason = 'Missing browser headers';
    if (!category) category = 'api-client';
  }

  // Check 3: Suspicious behavior patterns
  const behaviorScore = analyzeBehavior(req);
  if (behaviorScore > 0) {
    confidence += behaviorScore;
    if (!reason) reason = 'Suspicious request pattern';
    if (!category) category = 'suspicious';
  }

  // Normalize confidence to 0–1
  confidence = Math.min(1, confidence / 3);

  return {
    isBot: confidence > 0.6,
    confidence,
    reason: confidence > 0.3 ? reason : undefined,
    category,
  };
}

// ─── User-Agent analysis ──────────────────────────────────────────────────────

function analyzeUserAgent(ua: string): {
  score: number;
  reason: string;
  category: BotDetectionResult['category'];
} {
  if (!ua || ua.length < 10) {
    return { score: 0.8, reason: 'Missing or very short user-agent', category: 'api-client' };
  }

  // Check against allowed bots first (whitelist)
  for (const pattern of ALLOWED_BOTS) {
    if (pattern.test(ua)) {
      return { score: 0, reason: '', category: undefined };
    }
  }

  // Check against suspicious patterns
  for (const pattern of BOT_USER_AGENTS) {
    if (pattern.test(ua)) {
      let category: BotDetectionResult['category'] = 'scraper';
      if (/headless|puppeteer|playwright/i.test(ua)) category = 'headless';
      if (/curl|wget|python|ruby|perl|java/i.test(ua)) category = 'api-client';
      if (/nmap|nikto|sqlmap|burp/i.test(ua)) category = 'scraper';

      return {
        score: 0.7,
        reason: `Suspicious user-agent: ${ua.substring(0, 50)}`,
        category,
      };
    }
  }

  return { score: 0, reason: '', category: undefined };
}

// ─── Browser header analysis ──────────────────────────────────────────────────

function analyzeBrowserHeaders(req: NextRequest): number {
  const headers = req.headers;
  let missing = 0;
  let total = 0;

  // Real browsers always send these
  const requiredHeaders = [
    'accept',           // browsers send this
    'accept-language',  // language preference
    'accept-encoding', // compression support
  ];

  for (const h of requiredHeaders) {
    total++;
    if (!headers.get(h)) missing++;
  }

  // If more than half are missing, likely a bot
  return missing > total / 2 ? 0.6 : 0;
}

// ─── Behavioral analysis ──────────────────────────────────────────────────────

function analyzeBehavior(req: NextRequest): number {
  const pathname = req.nextUrl.pathname;

  // Robots.txt, sitemap, and other non-user requests are normal for bots
  if (pathname.match(/^\/(robots\.txt|sitemap\.xml|\.well-known|favicon\.ico)$/i)) {
    return 0; // these are normal bot requests
  }

  // Rapid sequential requests to many different endpoints (scraping pattern)
  const referer = req.headers.get('referer');
  if (!referer && !pathname.startsWith('/api')) {
    // No referer + direct API call = suspicious
    return 0.3;
  }

  // Missing typical browser "sec-" headers (Fetch Metadata)
  if (!req.headers.get('sec-fetch-site') && req.method === 'GET') {
    return 0.2; // slight suspicious signal
  }

  return 0;
}

// ─── Response helper ──────────────────────────────────────────────────────────

export function botDetectionHeaders(result: BotDetectionResult): Record<string, string> {
  return {
    'X-Bot-Score': result.confidence.toFixed(2),
    'X-Bot-Detected': result.isBot ? 'true' : 'false',
  };
}

// ─── Blocklist for known malicious IPs ───────────────────────────────────────
// Add your own known bad IPs here, or integrate with a service like AbuseIPDB

const IP_BLOCKLIST = new Set<string>([
  // Add known malicious IPs here
  // e.g. '192.0.2.1', '198.51.100.2'
]);

export function isIPBlocked(ip: string): boolean {
  return IP_BLOCKLIST.has(ip);
}

export function blockIP(ip: string) {
  IP_BLOCKLIST.add(ip);
}

export function unblockIP(ip: string) {
  IP_BLOCKLIST.delete(ip);
}
