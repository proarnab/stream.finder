// lib/autoblock.ts — Automatic IP blocking based on security event thresholds
import { blockIP, unblockIP } from './botdetection';
import { logIPBlocked } from './securitylog';
import prisma from './prisma';

const THRESHOLDS = {
  LOGIN_FAILED:        parseInt(process.env.AUTO_BLOCK_LOGIN_FAIL_COUNT   ?? '10'),
  RATE_LIMIT_EXCEEDED: parseInt(process.env.AUTO_BLOCK_RATE_LIMIT_COUNT   ?? '20'),
  BOT_DETECTED:        parseInt(process.env.AUTO_BLOCK_BOT_COUNT          ?? '5'),
};
const WINDOW_MINUTES = parseInt(process.env.AUTO_BLOCK_WINDOW_MINUTES   ?? '15');
const BLOCK_MINUTES  = parseInt(process.env.AUTO_BLOCK_DURATION_MINUTES ?? '60');
const CHECK_INTERVAL = 60_000;

const blockExpiry = new Map<string, number>();

export function isAutoBlocked(ip: string): boolean {
  const exp = blockExpiry.get(ip);
  if (!exp) return false;
  if (Date.now() > exp) { blockExpiry.delete(ip); unblockIP(ip); return false; }
  return true;
}

async function checkAndBlock() {
  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000);
  try {
    const events = await prisma.securityLog.groupBy({
      by: ['ip', 'type'],
      where: { createdAt: { gte: since }, type: { in: ['LOGIN_FAILED','RATE_LIMIT_EXCEEDED','BOT_DETECTED'] } },
      _count: true,
    });
    const byIp = new Map<string, Record<string, number>>();
    for (const e of events) {
      if (!byIp.has(e.ip)) byIp.set(e.ip, {});
      byIp.get(e.ip)![e.type] = e._count;
    }
    for (const [ip, counts] of byIp.entries()) {
      if (isAutoBlocked(ip)) continue;
      const reasons: string[] = [];
      if ((counts.LOGIN_FAILED ?? 0) >= THRESHOLDS.LOGIN_FAILED) reasons.push(`${counts.LOGIN_FAILED} failed logins`);
      if ((counts.RATE_LIMIT_EXCEEDED ?? 0) >= THRESHOLDS.RATE_LIMIT_EXCEEDED) reasons.push(`${counts.RATE_LIMIT_EXCEEDED} rate-limit hits`);
      if ((counts.BOT_DETECTED ?? 0) >= THRESHOLDS.BOT_DETECTED) reasons.push(`${counts.BOT_DETECTED} bot detections`);
      if (reasons.length > 0) {
        const reason = reasons.join('; ');
        blockIP(ip);
        blockExpiry.set(ip, Date.now() + BLOCK_MINUTES * 60_000);
        logIPBlocked(ip, `Auto-blocked: ${reason}`);
        try {
          await prisma.$executeRawUnsafe(
            `INSERT INTO "IpBlock" (id, ip, reason, "autoBlocked", "blockedUntil", "createdAt", "updatedAt")
             VALUES (gen_random_uuid(), $1, $2, true, $3, NOW(), NOW())
             ON CONFLICT (ip) DO UPDATE SET reason=$2, "blockedUntil"=$3, "updatedAt"=NOW()`,
            ip, reason, new Date(Date.now() + BLOCK_MINUTES * 60_000)
          );
        } catch { /* table may not exist yet */ }
      }
    }
  } catch (err) { console.error('[AUTO-BLOCK] Error:', err); }
}

let timer: ReturnType<typeof setInterval> | null = null;
export function startAutoBlocker() {
  if (timer) return;
  if (process.env.NODE_ENV !== 'production' && !process.env.FORCE_AUTO_BLOCKER) return;
  timer = setInterval(checkAndBlock, CHECK_INTERVAL);
  checkAndBlock();
}
export function stopAutoBlocker() {
  if (timer) { clearInterval(timer); timer = null; }
}
