'use client';
// app/register/page.tsx
import { useState, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CaptchaWidget, getCaptchaToken, resetCaptcha } from '@/components/ui/CaptchaWidget';

const ROLES = [
  { id: 'USER', label: 'Movie Fan', description: 'Track watchlists, write reviews', icon: '🎬' },
  { id: 'CRITIC', label: 'Film Critic', description: 'Earn commissions, build an audience', icon: '✍️' },
  { id: 'CREATOR', label: 'Filmmaker / Actor', description: 'Get discovered, show your work', icon: '🎥' },
];

function RegisterForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const ref          = searchParams.get('ref') ?? '';

  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole]         = useState('USER');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [captchaReady, setCaptchaReady] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const captchaToken = getCaptchaToken();

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role, referralCode: ref || undefined, captchaToken }),
      });

      const data = await res.json() as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Registration failed');
        resetCaptcha();
        setCaptchaReady(false);
        setLoading(false);
        return;
      }

      // Auto sign-in
      await signIn('credentials', { email, password, redirect: false });
      router.push('/profile?welcome=1');
    } catch {
      setError('Something went wrong. Please try again.');
      resetCaptcha();
      setCaptchaReady(false);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 pt-16 pb-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <span className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center text-white font-bold">
              S
            </span>
            <span className="font-display text-xl font-semibold text-white">
              Stream<span className="text-brand-400">Finder</span>
            </span>
          </Link>
          <h1 className="text-2xl font-display font-bold text-white">Create your account</h1>
          <p className="text-slate-400 text-sm mt-1">
            {ref ? 'Referred by a critic — join the community' : 'Join the community'}
          </p>
        </div>

        <div className="card p-6 space-y-5">
          {/* OAuth */}
          <button
            onClick={() => signIn('google', { callbackUrl: '/profile?welcome=1' })}
            className="w-full btn-ghost justify-center gap-3 py-3"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign up with Google
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-white/[0.06]" />
            <span className="text-xs text-slate-600">or</span>
            <div className="flex-1 h-px bg-white/[0.06]" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Role picker */}
            <div>
              <label className="text-xs font-medium text-slate-400 mb-2 block">I am a…</label>
              <div className="grid grid-cols-3 gap-2">
                {ROLES.map(r => (
                  <button
                    key={r.id} type="button"
                    onClick={() => setRole(r.id)}
                    disabled={loading}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-center transition-all duration-200 disabled:opacity-50
                      ${role === r.id
                        ? 'bg-brand-500/15 border-brand-500/50 text-brand-400'
                        : 'bg-surface-700 border-white/[0.06] text-slate-400 hover:border-white/20'}`}
                  >
                    <span className="text-xl">{r.icon}</span>
                    <span className="text-[11px] font-medium leading-tight">{r.label}</span>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-600 mt-1.5 text-center">
                {ROLES.find(r => r.id === role)?.description}
              </p>
            </div>

            {/* CAPTCHA */}
            <CaptchaWidget
              onVerify={() => setCaptchaReady(true)}
              onError={() => { setCaptchaReady(false); setError('CAPTCHA verification failed'); }}
              theme="dark"
              size="normal"
              className="w-full"
            />

            <div>
              <label className="text-xs font-medium text-slate-400 mb-1.5 block">Full Name</label>
              <input
                type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="Your name" required minLength={2} disabled={loading}
                className="search-input py-3 text-sm disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-400 mb-1.5 block">Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" required disabled={loading}
                className="search-input py-3 text-sm disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-400 mb-1.5 block">Password</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Min 8 characters" required minLength={8} disabled={loading}
                className="search-input py-3 text-sm disabled:opacity-50"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !captchaReady}
              className="w-full btn-primary justify-center py-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-slate-500 mt-4">
          Already have an account?{' '}
          <Link href="/login" className="text-brand-400 hover:text-brand-300 font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return <Suspense fallback={<div>Loading...</div>}><RegisterForm /></Suspense>;
}
