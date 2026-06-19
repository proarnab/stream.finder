// lib/securitylog.ts
// Log all security events (failed logins, rate limits, bot detection, CAPTCHA failures)
// For auditing and investigating suspicious activity

import { NextRequest } from 'next/server';
import prisma from './prisma';
import { getClientIP } from './ratelimit';

export type SecurityEventType =
  | 'LOGIN_ATTEMPT'
  | 'LOGIN_FAILED'
  | 'REGISTER_ATTEMPT'
  | 'REGISTER_FAILED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'BOT_DETECTED'
  | 'CAPTCHA_FAILED'
  | 'IP_BLOCKED'
  | 'SUSPICIOUS_ACTIVITY'
  | 'PASSWORD_RESET_ATTEMPT'
  | 'PAYMENT_SUSPICIOUS';

export interface SecurityLogEntry {
  type: SecurityEventType;
  ip: string;
  userId?: string;
  email?: string;
  endpoint: string;
  userAgent?: string;
  details?: Record<string, unknown>;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

// ─── In-memory event buffer (for rate limiting sensitive calls) ──────────────
const eventBuffer: SecurityLogEntry[] = [];
const BUFFER_SIZE = 100;
const FLUSH_INTERVAL = 5000; // 5 seconds

let flushTimer: NodeJS.Timeout;

function scheduleFlush() {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(flushBuffer, FLUSH_INTERVAL);
}

async function flushBuffer() {
  if (eventBuffer.length === 0) return;

  const events = [...eventBuffer];
  eventBuffer.length = 0;

  try {
    // Batch insert into database (PostgreSQL supports UNNEST for bulk inserts)
    await prisma.$executeRawUnsafe(`
      INSERT INTO security_logs (type, ip, "userId", email, endpoint, "userAgent", details, severity, "createdAt")
      VALUES ${events
        .map(
          (e, i) =>
            `($${i * 8 + 1}, $${i * 8 + 2}, $${i * 8 + 3}, $${i * 8 + 4}, $${i * 8 + 5}, $${i * 8 + 6}, $${i * 8 + 7}, $${i * 8 + 8}, NOW())`
        )
        .join(',')}
    `,
      ...events.flatMap(e => [e.type, e.ip, e.userId ?? null, e.email ?? null, e.endpoint, e.userAgent ?? null, JSON.stringify(e.details ?? {}), e.severity])
    );
  } catch (err) {
    console.error('Failed to flush security logs:', err);
    // Don't throw — keep the app running
  }
}

// ─── Public logging function ───────────────────────────────────────────────────

/**
 * Log a security event.
 * Buffers events and flushes to database every 5 seconds.
 */
export function logSecurityEvent(entry: SecurityLogEntry) {
  eventBuffer.push(entry);

  // Auto-flush if buffer is full
  if (eventBuffer.length >= BUFFER_SIZE) {
    flushBuffer();
  } else {
    scheduleFlush();
  }

  // Also log to console for real-time monitoring
  if (entry.severity === 'critical' || entry.severity === 'high') {
    console.warn(`[SECURITY] ${entry.type} from ${entry.ip}:`, entry.details);
  }
}

// ─── Convenience wrappers ─────────────────────────────────────────────────────

export function logLoginAttempt(ip: string, email: string, success: boolean, userAgent?: string) {
  logSecurityEvent({
    type: success ? 'LOGIN_ATTEMPT' : 'LOGIN_FAILED',
    ip,
    email,
    endpoint: '/api/auth/login',
    userAgent,
    details: { success },
    severity: success ? 'low' : 'medium',
  });
}

export function logRateLimitExceeded(req: NextRequest, endpoint: string, remaining: number) {
  logSecurityEvent({
    type: 'RATE_LIMIT_EXCEEDED',
    ip: getClientIP(req),
    endpoint,
    userAgent: req.headers.get('user-agent') ?? undefined,
    details: { remaining },
    severity: 'medium',
  });
}

export function logBotDetected(ip: string, confidence: number, reason?: string) {
  logSecurityEvent({
    type: 'BOT_DETECTED',
    ip,
    endpoint: '/*',
    details: { confidence, reason },
    severity: confidence > 0.8 ? 'high' : 'low',
  });
}

export function logCaptchaFailed(ip: string, endpoint: string, reason?: string) {
  logSecurityEvent({
    type: 'CAPTCHA_FAILED',
    ip,
    endpoint,
    details: { reason },
    severity: 'medium',
  });
}

export function logIPBlocked(ip: string, reason?: string) {
  logSecurityEvent({
    type: 'IP_BLOCKED',
    ip,
    endpoint: '/*',
    details: { reason },
    severity: 'high',
  });
}

export function logSuspiciousActivity(ip: string, endpoint: string, description: string, userId?: string) {
  logSecurityEvent({
    type: 'SUSPICIOUS_ACTIVITY',
    ip,
    userId,
    endpoint,
    details: { description },
    severity: 'high',
  });
}

// ─── Query security logs (admin dashboard) ──────────────────────────────────

export async function getSecurityLogs(
  options: {
    type?: SecurityEventType;
    ip?: string;
    userId?: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    hoursBack?: number;
    limit?: number;
  } = {}
) {
  const { type, ip, userId, severity, hoursBack = 24, limit = 100 } = options;

  return prisma.securityLog.findMany({
    where: {
      ...(type && { type }),
      ...(ip && { ip }),
      ...(userId && { userId }),
      ...(severity && { severity }),
      createdAt: { gte: new Date(Date.now() - hoursBack * 60 * 60 * 1000) },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

/**
 * Get summary stats for security dashboard
 */
export async function getSecurityStats(hoursBack: number = 24) {
  const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

  const [totalEvents, byType, highSeverity, uniqueIPs] = await Promise.all([
    prisma.securityLog.count({ where: { createdAt: { gte: since } } }),
    prisma.securityLog.groupBy({
      by: ['type'],
      where: { createdAt: { gte: since } },
      _count: true,
    }),
    prisma.securityLog.count({
      where: {
        createdAt: { gte: since },
        severity: { in: ['high', 'critical'] },
      },
    }),
    prisma.securityLog.findMany({
      where: { createdAt: { gte: since } },
      select: { ip: true },
      distinct: ['ip'],
    }),
  ]);

  return {
    totalEvents,
    byType: Object.fromEntries(byType.map(x => [x.type, x._count])),
    highSeverityCount: highSeverity,
    uniqueIPCount: uniqueIPs.length,
    timeRange: `Last ${hoursBack} hours`,
  };
}

// ─── Ensure logs are flushed on shutdown ───────────────────────────────────

if (process.env.NODE_ENV === 'production') {
  process.on('SIGTERM', async () => {
    console.log('Flushing security logs before shutdown...');
    await flushBuffer();
    process.exit(0);
  });
}
