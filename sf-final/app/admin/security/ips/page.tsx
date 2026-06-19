// app/admin/security/ips/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface IPEntry {
  ip: string;
  reason?: string;
  addedAt: string;
  addedBy?: string;
}

export default function IPManagementPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [blocklist, setBlocklist] = useState<IPEntry[]>([]);
  const [allowlist, setAllowlist] = useState<IPEntry[]>([]);
  const [newIP, setNewIP] = useState('');
  const [reason, setReason] = useState('');
  const [listType, setListType] = useState<'block' | 'allow'>('block');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Only admins
  useEffect(() => {
    if (session && session.user.role !== 'ADMIN') {
      router.push('/');
    }
  }, [session, router]);

  // Load lists
  useEffect(() => {
    fetch('/api/admin/security/ips')
      .then(r => r.json())
      .then((d: { blocklist: IPEntry[]; allowlist: IPEntry[] }) => {
        setBlocklist(d.blocklist || []);
        setAllowlist(d.allowlist || []);
      })
      .catch(() => setMessage('Failed to load IP lists'))
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIP.trim()) return;
    setSaving(true);
    setMessage('');

    try {
      const res = await fetch('/api/admin/security/ips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: newIP.trim(), type: listType, reason }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) {
        setMessage(data.error || 'Failed to add IP');
      } else {
        setMessage(`✓ ${newIP} added to ${listType}list`);
        setNewIP('');
        setReason('');
        // Reload lists
        fetch('/api/admin/security/ips')
          .then(r => r.json())
          .then((d: { blocklist: IPEntry[]; allowlist: IPEntry[] }) => {
            setBlocklist(d.blocklist || []);
            setAllowlist(d.allowlist || []);
          });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (ip: string, type: 'block' | 'allow') => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/security/ips?ip=${encodeURIComponent(ip)}&type=${type}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setMessage(`✓ Removed ${ip} from ${type}list`);
        if (type === 'block') {
          setBlocklist(blocklist.filter(e => e.ip !== ip));
        } else {
          setAllowlist(allowlist.filter(e => e.ip !== ip));
        }
      } else {
        setMessage('Failed to remove IP');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-24 pb-16">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/admin/security" className="text-slate-500 hover:text-white">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <p className="section-label mb-0.5">Security</p>
          <h1 className="section-title">IP Management</h1>
        </div>
      </div>

      {/* Add IP form */}
      <div className="card p-6 mb-6">
        <h2 className="font-display font-semibold text-white mb-4">Add IP to List</h2>
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">IP Address</label>
              <input
                type="text"
                value={newIP}
                onChange={e => setNewIP(e.target.value)}
                placeholder="203.0.113.45"
                className="search-input py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">List Type</label>
              <select
                value={listType}
                onChange={e => setListType(e.target.value as 'block' | 'allow')}
                className="search-input py-2.5 text-sm bg-surface-800"
              >
                <option value="block">🔴 Blocklist</option>
                <option value="allow">🟢 Allowlist</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Reason (optional)</label>
              <input
                type="text"
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="e.g. DDoS, abuse"
                maxLength={50}
                className="search-input py-2.5 text-sm"
              />
            </div>
            <div className="flex items-end">
              <button type="submit" disabled={saving || !newIP.trim()} className="btn-primary w-full">
                {saving ? 'Adding...' : 'Add IP'}
              </button>
            </div>
          </div>
        </form>
        {message && (
          <p className={`text-sm mt-3 ${message.startsWith('✓') ? 'text-emerald-400' : 'text-red-400'}`}>
            {message}
          </p>
        )}
      </div>

      {/* Blocklist */}
      <div className="card p-5 mb-6">
        <h2 className="font-display font-semibold text-white mb-4">
          🔴 Blocklist ({blocklist.length})
        </h2>
        {blocklist.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-white/10">
                <tr>
                  <th className="text-left py-2 px-2 text-xs text-slate-500">IP</th>
                  <th className="text-left py-2 px-2 text-xs text-slate-500">REASON</th>
                  <th className="text-left py-2 px-2 text-xs text-slate-500">ADDED</th>
                  <th className="text-right py-2 px-2 text-xs text-slate-500">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {blocklist.map(entry => (
                  <tr key={entry.ip} className="hover:bg-surface-900">
                    <td className="py-2 px-2 font-mono text-slate-300">{entry.ip}</td>
                    <td className="py-2 px-2 text-slate-500">{entry.reason || '—'}</td>
                    <td className="py-2 px-2 text-slate-500 text-xs">
                      {new Date(entry.addedAt).toLocaleDateString()}
                    </td>
                    <td className="py-2 px-2 text-right">
                      <button
                        onClick={() => handleRemove(entry.ip, 'block')}
                        className="text-red-400 hover:text-red-300 text-xs"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-slate-500 text-sm text-center py-6">No blocked IPs</p>
        )}
      </div>

      {/* Allowlist */}
      <div className="card p-5">
        <h2 className="font-display font-semibold text-white mb-4">
          🟢 Allowlist ({allowlist.length})
        </h2>
        {allowlist.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-white/10">
                <tr>
                  <th className="text-left py-2 px-2 text-xs text-slate-500">IP</th>
                  <th className="text-left py-2 px-2 text-xs text-slate-500">REASON</th>
                  <th className="text-left py-2 px-2 text-xs text-slate-500">ADDED</th>
                  <th className="text-right py-2 px-2 text-xs text-slate-500">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {allowlist.map(entry => (
                  <tr key={entry.ip} className="hover:bg-surface-900">
                    <td className="py-2 px-2 font-mono text-slate-300">{entry.ip}</td>
                    <td className="py-2 px-2 text-slate-500">{entry.reason || '—'}</td>
                    <td className="py-2 px-2 text-slate-500 text-xs">
                      {new Date(entry.addedAt).toLocaleDateString()}
                    </td>
                    <td className="py-2 px-2 text-right">
                      <button
                        onClick={() => handleRemove(entry.ip, 'allow')}
                        className="text-red-400 hover:text-red-300 text-xs"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-slate-500 text-sm text-center py-6">No allowlisted IPs</p>
        )}
      </div>
    </div>
  );
}
