// components/layout/Navbar.tsx
'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Image from 'next/image';

export function Navbar() {
  const router = useRouter();
  const { data: session } = useSession();
  const [query, setQuery] = useState('');
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}&semantic=1`);
      setQuery('');
    }
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-surface-950/95 backdrop-blur-md border-b border-white/[0.06]' : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 flex-shrink-0 group">
          <span className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-brand-500/30 group-hover:shadow-brand-500/50 transition-shadow">
            S
          </span>
          <span className="font-display font-semibold text-lg text-white hidden sm:block">
            Stream<span className="text-brand-400">Finder</span>
          </span>
        </Link>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex-1 max-w-lg">
          <div className="relative">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none"
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder='Try "horror set in London 2023"…'
              className="w-full bg-surface-800/80 border border-white/[0.08] rounded-xl pl-10 pr-4 py-2.5
                         text-sm text-white placeholder-slate-500 outline-none
                         focus:border-brand-500/40 focus:bg-surface-800 focus:ring-1 focus:ring-brand-500/20
                         transition-all duration-200"
            />
          </div>
        </form>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          <Link href="/discover" className="text-sm text-slate-400 hover:text-white px-3 py-2 rounded-lg hover:bg-white/5 transition-colors">
            Discover
          </Link>
          <Link href="/free" className="text-sm text-emerald-400 hover:text-emerald-300 px-3 py-2 rounded-lg hover:bg-emerald-500/10 transition-colors font-medium">
            Free Now
          </Link>
          <Link href="/pricing" className="text-sm text-slate-400 hover:text-white px-3 py-2 rounded-lg hover:bg-white/5 transition-colors">
            Pricing
          </Link>
        </nav>

        {/* Auth */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {session?.user ? (
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(o => !o)}
                onBlur={() => setTimeout(() => setUserMenuOpen(false), 150)}
                className="flex items-center gap-2 p-1 rounded-full hover:ring-2 hover:ring-brand-500/40 transition-all"
              >
                <div className="w-8 h-8 rounded-full overflow-hidden bg-brand-500/20 flex items-center justify-center">
                  {session.user.image ? (
                    <Image src={session.user.image} alt="" width={32} height={32} className="object-cover" />
                  ) : (
                    <span className="text-brand-400 text-sm font-bold">
                      {(session.user.name ?? session.user.email ?? 'U')[0].toUpperCase()}
                    </span>
                  )}
                </div>
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-surface-800 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 animate-scale-in">
                  <div className="px-3 py-2.5 border-b border-white/[0.06]">
                    <p className="text-xs font-medium text-white truncate">{session.user.name}</p>
                    <p className="text-[10px] text-slate-500 truncate">{session.user.email}</p>
                  </div>
                  <Link href="/profile" className="flex items-center gap-2 px-3 py-2.5 text-sm text-slate-300 hover:bg-surface-700 hover:text-white transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    My Profile
                  </Link>
                  <Link href="/profile/watchlist" className="flex items-center gap-2 px-3 py-2.5 text-sm text-slate-300 hover:bg-surface-700 hover:text-white transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                    Watchlist
                  </Link>
                  <Link href="/pricing" className="flex items-center gap-2 px-3 py-2.5 text-sm text-slate-300 hover:bg-surface-700 hover:text-white transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                    Upgrade
                  </Link>
                  <div className="border-t border-white/[0.06]">
                    <button
                      onClick={() => signOut({ callbackUrl: '/' })}
                      className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link href="/login" className="text-sm text-slate-400 hover:text-white px-3 py-2 transition-colors hidden sm:block">
                Sign in
              </Link>
              <Link href="/register" className="btn-primary text-sm py-2 px-4">
                Join Free
              </Link>
            </>
          )}

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="md:hidden p-2 text-slate-400 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-surface-900 border-t border-white/[0.06] px-4 py-4 space-y-1 animate-fade-in">
          {[
            { href: '/discover', label: 'Discover' },
            { href: '/free', label: '▶ Free Now' },
            { href: '/pricing', label: 'Pricing' },
            { href: '/profile', label: 'My Profile' },
          ].map(({ href, label }) => (
            <Link key={href} href={href}
              onClick={() => setMenuOpen(false)}
              className="block px-4 py-3 text-sm text-slate-300 hover:text-white hover:bg-surface-700 rounded-xl transition-colors">
              {label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
