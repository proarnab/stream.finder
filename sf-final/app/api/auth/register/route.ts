// app/api/auth/register/route.ts — HARDENED
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { verifyCaptcha, extractCaptchaToken } from '@/lib/captcha';
import { getClientIP, rateLimitByUser, RATE_LIMITS } from '@/lib/ratelimit';
import { sanitizeEmail, clean } from '@/lib/sanitize';
import { logSecurityEvent } from '@/lib/securitylog';

const PASSWORD_PATTERN = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}$/;

const schema = z.object({
  name:         z.string().min(2).max(60),
  email:        z.string().email().max(254),
  password:     z.string().min(8).max(100).refine(p => PASSWORD_PATTERN.test(p), {
    message: 'Password must contain uppercase, number, and special character',
  }),
  referralCode: z.string().max(60).optional(),
  captchaToken: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const ip = getClientIP(req);
  const captchaToken = await extractCaptchaToken(req);
  const captcha = await verifyCaptcha(captchaToken, ip);

  if (!captcha.success) {
    logSecurityEvent({ type: 'CAPTCHA_FAILED', ip, endpoint: '/api/auth/register', details: { error: captcha.error }, severity: 'medium' });
    return NextResponse.json({ error: 'CAPTCHA verification failed' }, { status: 400 });
  }

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await req.json());
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Invalid input', details: err.errors }, { status: 400 });
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  const { name, email: rawEmail, password, referralCode } = body;
  const email = sanitizeEmail(rawEmail);
  const displayName = clean(name, 60);

  const emailRl = await rateLimitByUser(`reg:${email}`, { ...RATE_LIMITS.REGISTER, prefix: 'rl:reg-email' });
  if (!emailRl.success) return NextResponse.json({ error: 'Too many attempts for this email.' }, { status: 429 });

  const [existing, passwordHash] = await Promise.all([
    prisma.user.findUnique({ where: { email }, select: { id: true } }),
    bcrypt.hash(password, 12),
  ]);

  if (existing) {
    if (process.env.NODE_ENV === 'development') return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    return NextResponse.json({ message: "If this email isn't registered yet, you'll receive a confirmation shortly." }, { status: 200 });
  }

  try {
    const user = await prisma.user.create({
      data: { name: displayName, email, passwordHash, role: 'USER', profile: { create: { displayName, preferredCurrency: 'USD' } } },
    });

    if (referralCode) {
      const affiliateCode = await prisma.affiliateCode.findUnique({ where: { code: referralCode.trim() }, select: { id: true, userId: true } });
      if (affiliateCode) {
        await prisma.$transaction([
          prisma.referral.create({ data: { affiliateCodeId: affiliateCode.id, referrerId: affiliateCode.userId, referredUserId: user.id } }),
          prisma.affiliateCode.update({ where: { id: affiliateCode.id }, data: { conversions: { increment: 1 } } }),
        ]);
      }
    }

    logSecurityEvent({ type: 'REGISTER_ATTEMPT', ip, endpoint: '/api/auth/register', userId: user.id, email, details: { success: true }, severity: 'low' });
    return NextResponse.json({ message: 'Account created successfully', userId: user.id }, { status: 201 });
  } catch (err) {
    console.error('Register error:', err);
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }
}
