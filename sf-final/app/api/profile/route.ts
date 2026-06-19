// app/api/profile/route.ts — HARDENED
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { stripHtml, clean, sanitizeUrl } from '@/lib/sanitize';

const HANDLE_REGEX = /^[a-zA-Z0-9_.\-]{1,50}$/;

const updateSchema = z.object({
  displayName:       z.string().max(60).optional(),
  bio:               z.string().max(500).optional(),
  website:           z.string().url().optional().or(z.literal('')),
  country:           z.string().length(2).regex(/^[A-Z]{2}$/).optional(),
  preferredCurrency: z.string().max(3).regex(/^[A-Z]{3}$/).optional(),
  twitterHandle:    z.string().regex(HANDLE_REGEX).max(50).optional().or(z.literal('')),
  instagramHandle:  z.string().regex(HANDLE_REGEX).max(50).optional().or(z.literal('')),
  youtubeChannel:   z.string().max(100).optional().or(z.literal('')),
  criticBadge:      z.string().max(50).optional().or(z.literal('')),
  agentEmail:       z.string().email().max(254).optional().or(z.literal('')),
  reelUrl:          z.string().url().optional().or(z.literal('')),
  availableForWork: z.boolean().optional(),
  imdbLink:         z.string().url().optional().or(z.literal('')),
});

export async function GET() {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const profile = await prisma.userProfile.findUnique({ where: { userId: session.user.id } });
  return NextResponse.json(profile ?? {});
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: z.infer<typeof updateSchema>;
  try {
    body = updateSchema.parse(await req.json());
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Validation failed', details: err.errors }, { status: 400 });
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  const sanitized = {
    ...body,
    displayName: body.displayName !== undefined ? clean(stripHtml(body.displayName), 60) : undefined,
    bio:         body.bio !== undefined ? clean(stripHtml(body.bio), 500) : undefined,
    website:     body.website ? sanitizeUrl(body.website) : body.website,
    reelUrl:     body.reelUrl ? sanitizeUrl(body.reelUrl) : body.reelUrl,
    imdbLink:    body.imdbLink ? sanitizeUrl(body.imdbLink) : body.imdbLink,
  };

  try {
    const profile = await prisma.userProfile.upsert({
      where:  { userId: session.user.id },
      create: { userId: session.user.id, ...sanitized },
      update: sanitized,
    });
    return NextResponse.json(profile);
  } catch (err) {
    console.error('Profile update error:', err);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}
