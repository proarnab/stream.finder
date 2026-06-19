'use client';
// app/profile/edit/page.tsx
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ProfileEditPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [form, setForm] = useState({
    displayName: '', bio: '', website: '',
    country: 'US', preferredCurrency: 'USD',
    twitterHandle: '', instagramHandle: '', youtubeChannel: '',
    criticBadge: '', agentEmail: '', reelUrl: '',
    availableForWork: false, imdbLink: '',
  });
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [message, setMessage]   = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return; }
    if (status !== 'authenticated') return;
    fetch('/api/profile')
      .then(r => r.json())
      .then((d: typeof form) => { if (d) setForm(f => ({ ...f, ...d })); })
      .finally(() => setLoading(false));
  }, [status, router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setMessage('');
    const res  = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setMessage(res.ok ? '✓ Profile saved successfully!' : '✗ Failed to save. Please try again.');
    if (res.ok) setTimeout(() => router.push('/profile'), 1500);
  };

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [key]: (e.target as HTMLInputElement).type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }));

  const role = session?.user?.role ?? 'USER';
  const isCritic  = role === 'CRITIC'  || role === 'ADMIN';
  const isCreator = role === 'CREATOR' || role === 'ADMIN';

  if (loading) return (
    <div className="max-w-2xl mx-auto px-4 pt-28 pb-16 space-y-4">
      {[1,2,3,4].map(i => <div key={i} className="skeleton h-12 w-full rounded-xl" />)}
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-24 pb-16">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/profile" className="text-slate-500 hover:text-white transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <p className="section-label mb-0.5">Account Settings</p>
          <h1 className="text-2xl font-display font-bold text-white">Edit Profile</h1>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Basic info */}
        <div className="card p-5 space-y-4">
          <h2 className="font-display font-semibold text-white">Basic Information</h2>
          {[
            { label: 'Display Name', key: 'displayName' as const, placeholder: 'Your name', type: 'text' },
            { label: 'Website', key: 'website' as const, placeholder: 'https://yoursite.com', type: 'url' },
          ].map(({ label, key, placeholder, type }) => (
            <div key={key}>
              <label className="text-xs text-slate-400 mb-1.5 block">{label}</label>
              <input type={type} value={form[key] as string} onChange={set(key)} placeholder={placeholder} className="search-input py-3 text-sm" />
            </div>
          ))}
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Bio</label>
            <textarea value={form.bio} onChange={set('bio')} rows={3} placeholder="Tell people about yourself…"
              className="w-full bg-surface-800 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-brand-500/40 focus:ring-1 focus:ring-brand-500/20 resize-none transition-all" maxLength={500} />
            <p className="text-[10px] text-slate-600 mt-1">{form.bio.length}/500</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Country</label>
              <select value={form.country} onChange={set('country')} className="search-input py-3 text-sm bg-surface-800">
                {[['US','United States'],['IN','India'],['GB','United Kingdom'],['CA','Canada'],['AU','Australia'],['DE','Germany'],['FR','France'],['JP','Japan'],['KR','South Korea']].map(([v,l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Currency</label>
              <select value={form.preferredCurrency} onChange={set('preferredCurrency')} className="search-input py-3 text-sm bg-surface-800">
                <option value="USD">USD ($)</option>
                <option value="INR">INR (₹)</option>
                <option value="GBP">GBP (£)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Social links */}
        <div className="card p-5 space-y-4">
          <h2 className="font-display font-semibold text-white">Social Links</h2>
          {[
            { label: 'Twitter / X Handle', key: 'twitterHandle' as const, placeholder: '@yourhandle' },
            { label: 'Instagram Handle', key: 'instagramHandle' as const, placeholder: '@yourhandle' },
            { label: 'YouTube Channel URL', key: 'youtubeChannel' as const, placeholder: 'https://youtube.com/@channel' },
          ].map(({ label, key, placeholder }) => (
            <div key={key}>
              <label className="text-xs text-slate-400 mb-1.5 block">{label}</label>
              <input type="text" value={form[key] as string} onChange={set(key)} placeholder={placeholder} className="search-input py-3 text-sm" />
            </div>
          ))}
        </div>

        {/* Critic section */}
        {isCritic && (
          <div className="card p-5 space-y-4 border-purple-500/20">
            <h2 className="font-display font-semibold text-white flex items-center gap-2">
              <span>✍️</span> Critic Profile
            </h2>
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Critic Badge / Specialty</label>
              <input type="text" value={form.criticBadge} onChange={set('criticBadge')} placeholder="e.g. Horror Specialist, Indie Film Critic" className="search-input py-3 text-sm" maxLength={50} />
            </div>
          </div>
        )}

        {/* Creator section */}
        {isCreator && (
          <div className="card p-5 space-y-4 border-brand-500/20">
            <h2 className="font-display font-semibold text-white flex items-center gap-2">
              <span>🎬</span> Creator / Filmmaker Profile
            </h2>
            {[
              { label: 'Agent Email (shown on profile with Pro)', key: 'agentEmail' as const, placeholder: 'agent@agencyname.com', type: 'email' },
              { label: 'Showreel / Demo Reel URL', key: 'reelUrl' as const, placeholder: 'https://vimeo.com/youreel', type: 'url' },
              { label: 'IMDb Profile URL', key: 'imdbLink' as const, placeholder: 'https://imdb.com/name/nm...', type: 'url' },
            ].map(({ label, key, placeholder, type }) => (
              <div key={key}>
                <label className="text-xs text-slate-400 mb-1.5 block">{label}</label>
                <input type={type} value={form[key] as string} onChange={set(key)} placeholder={placeholder} className="search-input py-3 text-sm" />
              </div>
            ))}
            <label className="flex items-center gap-3 cursor-pointer">
              <div className={`relative w-10 h-6 rounded-full transition-colors ${form.availableForWork ? 'bg-emerald-500' : 'bg-surface-600'}`}
                onClick={() => setForm(f => ({ ...f, availableForWork: !f.availableForWork }))}>
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${form.availableForWork ? 'translate-x-5' : 'translate-x-1'}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Available for Work</p>
                <p className="text-xs text-slate-500">Shows a green badge on your public profile</p>
              </div>
            </label>
          </div>
        )}

        {message && (
          <div className={`rounded-xl px-4 py-3 text-sm ${message.startsWith('✓') ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
            {message}
          </div>
        )}

        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center py-3">
            {saving ? 'Saving…' : 'Save Profile'}
          </button>
          <Link href="/profile" className="btn-ghost px-6">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
