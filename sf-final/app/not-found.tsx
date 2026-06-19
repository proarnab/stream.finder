// app/not-found.tsx
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '404 — Page Not Found',
  robots: { index: false },
};

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <p className="font-mono text-8xl font-bold text-brand-500/20 mb-4">404</p>
        <h1 className="text-3xl font-display font-bold text-white mb-3">Page not found</h1>
        <p className="text-slate-400 mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex justify-center gap-3">
          <Link href="/" className="btn-primary">Go Home</Link>
          <Link href="/discover" className="btn-ghost">Browse Movies</Link>
        </div>
      </div>
    </div>
  );
}
