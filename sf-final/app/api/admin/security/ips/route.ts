// app/api/admin/security/ips/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

// Simple in-memory storage for demo (replace with DB in production)
const blocklist = new Map<string, { reason?: string; addedAt: string }>();
const allowlist = new Map<string, { reason?: string; addedAt: string }>();

// GET — retrieve current lists
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    blocklist: Array.from(blocklist.entries()).map(([ip, data]) => ({
      ip,
      ...data,
    })),
    allowlist: Array.from(allowlist.entries()).map(([ip, data]) => ({
      ip,
      ...data,
    })),
  });
}

// POST — add IP to list
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { ip, type, reason } = await req.json() as {
      ip: string;
      type: 'block' | 'allow';
      reason?: string;
    };

    // Validate IP format (simple check)
    if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
      return NextResponse.json({ error: 'Invalid IP format' }, { status: 400 });
    }

    const target = type === 'block' ? blocklist : allowlist;
    target.set(ip, { reason, addedAt: new Date().toISOString() });

    return NextResponse.json({ ok: true, message: `IP added to ${type}list` });
  } catch (err) {
    console.error('IP management error:', err);
    return NextResponse.json({ error: 'Failed to add IP' }, { status: 500 });
  }
}

// DELETE — remove IP from list
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ip = req.nextUrl.searchParams.get('ip');
  const type = req.nextUrl.searchParams.get('type') as 'block' | 'allow';

  if (!ip || !type) {
    return NextResponse.json({ error: 'Missing ip or type' }, { status: 400 });
  }

  const target = type === 'block' ? blocklist : allowlist;
  const removed = target.delete(ip);

  if (!removed) {
    return NextResponse.json({ error: 'IP not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
