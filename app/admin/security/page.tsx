// app/admin/security/page.tsx
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getSecurityStats } from '@/lib/securitylog';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Security Dashboard',
  robots: { index: false },
};

export default async function SecurityDashboardPage() {
  const session = await getSession();

  // Only admins can view this
  if (!session?.user || session.user.role !== 'ADMIN') {
    redirect('/');
  }

  const [stats24h, stats7d, recentLogs, topIPs, highSeverity] = await Promise.all([
    getSecurityStats(24),
    getSecurityStats(168), // 7 days
    prisma.securityLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.securityLog.groupBy({
      by: ['ip'],
      where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      _count: true,
      orderBy: { _count: { createdAt: 'desc' } },
      take: 10,
    }),
    prisma.securityLog.findMany({
      where: {
        severity: { in: ['high', 'critical'] },
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/admin" className="text-slate-500 hover:text-white transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <p className="section-label mb-0.5">System</p>
          <h1 className="section-title">Security Dashboard</h1>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="card p-5">
          <p className="text-xs text-slate-500 mb-1">Events (24h)</p>
          <p className="text-3xl font-bold text-white">{stats24h.totalEvents}</p>
          <p className="text-xs text-slate-600 mt-1">vs. {stats7d.totalEvents} (7d)</p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-slate-500 mb-1">High Severity</p>
          <p className={`text-3xl font-bold ${stats24h.highSeverityCount > 10 ? 'text-red-400' : 'text-emerald-400'}`}>
            {stats24h.highSeverityCount}
          </p>
          <p className="text-xs text-slate-600 mt-1">🚨 Needs attention</p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-slate-500 mb-1">Unique IPs</p>
          <p className="text-3xl font-bold text-white">{stats24h.uniqueIPCount}</p>
          <p className="text-xs text-slate-600 mt-1">In last 24h</p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-slate-500 mb-1">Status</p>
          <p className="text-xl font-bold text-emerald-400">🟢 Normal</p>
          <p className="text-xs text-slate-600 mt-1">No alerts</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent high-severity events */}
        <div className="lg:col-span-2">
          <div className="card p-5">
            <h2 className="font-display font-semibold text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
              </svg>
              High Severity Events
            </h2>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {highSeverity.length > 0 ? (
                highSeverity.map(log => (
                  <div key={log.id} className="bg-surface-900 rounded-lg px-3 py-2 text-xs border-l-2 border-red-500">
                    <p className="text-red-400 font-mono mb-0.5">{log.ip}</p>
                    <p className="text-slate-300">{log.type}</p>
                    <p className="text-slate-600 text-[10px] mt-1">
                      {new Date(log.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-slate-600 text-sm py-4 text-center">No high-severity events in the last 24 hours</p>
              )}
            </div>
          </div>
        </div>

        {/* Top attacking IPs */}
        <div>
          <div className="card p-5">
            <h2 className="font-display font-semibold text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Top IPs (24h)
            </h2>
            <div className="space-y-2">
              {topIPs.length > 0 ? (
                topIPs.map(({ ip, _count }) => (
                  <div key={ip} className="flex items-center justify-between p-2 bg-surface-900 rounded-lg">
                    <p className="text-xs font-mono text-slate-300">{ip}</p>
                    <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-1 rounded">
                      {_count} events
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-slate-600 text-xs text-center py-4">No activity</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recent logs table */}
      <div className="card p-5 mt-6">
        <h2 className="font-display font-semibold text-white mb-4">Recent Events</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-white/10">
              <tr>
                <th className="text-left py-2 px-2 text-xs text-slate-500 font-mono">TIME</th>
                <th className="text-left py-2 px-2 text-xs text-slate-500 font-mono">TYPE</th>
                <th className="text-left py-2 px-2 text-xs text-slate-500 font-mono">IP</th>
                <th className="text-left py-2 px-2 text-xs text-slate-500 font-mono">ENDPOINT</th>
                <th className="text-left py-2 px-2 text-xs text-slate-500 font-mono">SEVERITY</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {recentLogs.map(log => (
                <tr key={log.id} className="hover:bg-surface-900 transition-colors">
                  <td className="py-2 px-2 text-xs text-slate-400">
                    {new Date(log.createdAt).toLocaleTimeString()}
                  </td>
                  <td className="py-2 px-2 text-xs text-slate-300 font-mono">{log.type}</td>
                  <td className="py-2 px-2 text-xs text-slate-400">{log.ip}</td>
                  <td className="py-2 px-2 text-xs text-slate-500">{log.endpoint}</td>
                  <td className="py-2 px-2 text-xs">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                        log.severity === 'critical'
                          ? 'bg-red-500/20 text-red-400'
                          : log.severity === 'high'
                            ? 'bg-orange-500/20 text-orange-400'
                            : log.severity === 'medium'
                              ? 'bg-yellow-500/20 text-yellow-400'
                              : 'bg-slate-700 text-slate-400'
                      }`}
                    >
                      {log.severity}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Helper links */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/admin/security/logs?severity=high"
          className="card p-4 flex items-center gap-3 hover:bg-surface-700 transition-colors"
        >
          <span className="text-2xl">📋</span>
          <div>
            <p className="font-medium text-white">View All High-Severity Logs</p>
            <p className="text-xs text-slate-500">Detailed audit trail</p>
          </div>
        </Link>
        <Link
          href="/admin/security/ips"
          className="card p-4 flex items-center gap-3 hover:bg-surface-700 transition-colors"
        >
          <span className="text-2xl">🔒</span>
          <div>
            <p className="font-medium text-white">IP Allowlist/Blocklist</p>
            <p className="text-xs text-slate-500">Manage blocked IPs</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
