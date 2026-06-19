// components/layout/Footer.tsx
import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-white/[0.06] mt-20 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-7 h-7 rounded-md bg-brand-500 flex items-center justify-center text-white text-xs font-bold">S</span>
              <span className="font-display font-semibold text-white">Stream<span className="text-brand-400">Finder</span></span>
            </div>
            <p className="text-sm text-slate-500 leading-relaxed max-w-xs">
              A legal movie discovery platform. We help you find where to watch movies — we never host or stream content ourselves.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Discover</h4>
            <ul className="space-y-2 text-sm text-slate-500">
              <li><Link href="/free" className="hover:text-brand-400 transition-colors">Free to Stream</Link></li>
              <li><Link href="/discover" className="hover:text-brand-400 transition-colors">Browse All</Link></li>
              <li><Link href="/discover?genre=27" className="hover:text-brand-400 transition-colors">Horror</Link></li>
              <li><Link href="/discover?genre=35" className="hover:text-brand-400 transition-colors">Comedy</Link></li>
              <li><Link href="/discover?genre=878" className="hover:text-brand-400 transition-colors">Sci-Fi</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Legal</h4>
            <ul className="space-y-2 text-sm text-slate-500">
              <li><Link href="/privacy" className="hover:text-brand-400 transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-brand-400 transition-colors">Terms of Service</Link></li>
              <li><Link href="/dmca" className="hover:text-brand-400 transition-colors">DMCA</Link></li>
              <li><Link href="/about" className="hover:text-brand-400 transition-colors">About</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/[0.06] pt-6 flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-xs text-slate-600">
            © {new Date().getFullYear()} StreamFinder. This product uses the TMDb API but is not endorsed or certified by TMDb.
          </p>
          <div className="flex items-center gap-2">
            <img
              src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg"
              alt="TMDB Logo"
              className="h-4 opacity-40"
            />
          </div>
        </div>
      </div>
    </footer>
  );
}
