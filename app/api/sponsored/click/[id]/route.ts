// app/api/sponsored/click/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.spotlight.update({
      where: { id: params.id },
      data: { clicks: { increment: 1 } },
    });
  } catch {
    // Silently fail — don't block the user
  }
  return NextResponse.json({ ok: true });
}
