'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { StatCard, LoadingState } from '@/components/ui';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface AnalyticsData {
  totalMessages: number;
  totalConversations: number;
  activeUsers: number;
  averageMessagesPerConversation: number;
  totalCost: number;
}

interface UsageRecord {
  id: string;
  date: string;
  messages: number;
  tokens: number;
  cost?: number;
  conversations?: number;
}

export function AnalyticsContent() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [usage, setUsage] = useState<UsageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    let cancelled = false;
    async function loadAnalytics() {
      try {
        const [, usageData, costData] = await Promise.all([
          api.analytics.get(dateRange),
          api.analytics.getUsage(dateRange),
          api.analytics.getCost(dateRange),
        ]);
        if (!cancelled) {
          const totalMessages = usageData.reduce((sum, r) => sum + (r.messages || 0), 0);
          const totalConversations = usageData.reduce((sum, r) => sum + (r.conversations || 0), 0);
          const activeUsers = new Set(usageData.filter(r => (r.messages || 0) > 0).map(r => r.date)).size;
          const averageMessagesPerConversation = totalConversations > 0 ? totalMessages / totalConversations : 0;

          setAnalytics({
            totalMessages,
            totalConversations,
            activeUsers,
            averageMessagesPerConversation,
            totalCost: costData?.totalCost || 0,
          });
          setUsage(usageData);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load analytics');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadAnalytics();
    return () => { cancelled = true; };
  }, [dateRange]);

  if (loading) return <LoadingState />;
  if (error) return <div className="card p-4 text-sm text-red-600">{error}</div>;

  const chartData = usage.map(record => ({
    date: new Date(record.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    messages: record.messages || 0,
    tokens: record.tokens || 0,
    cost: (record.cost || 0).toFixed(4),
    conversations: record.conversations || 0,
  })).reverse();

  return (
    <div className="space-y-6">
      {/* Date range */}
      <div className="card flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center">
        <label className="text-sm font-medium text-slate-600">From</label>
        <input type="date" value={dateRange.from} onChange={e => setDateRange(prev => ({ ...prev, from: e.target.value }))} className="input sm:w-auto" />
        <label className="text-sm font-medium text-slate-600 sm:ml-2">To</label>
        <input type="date" value={dateRange.to} onChange={e => setDateRange(prev => ({ ...prev, to: e.target.value }))} className="input sm:w-auto" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Total Messages" value={analytics?.totalMessages ?? 0} />
        <StatCard label="Conversations" value={analytics?.totalConversations ?? 0} />
        <StatCard label="Active Days" value={analytics?.activeUsers ?? 0} />
        <StatCard label="Avg Msgs / Conv" value={(analytics?.averageMessagesPerConversation ?? 0).toFixed(1)} />
        <StatCard label="Total Cost" value={`$${(analytics?.totalCost || 0).toFixed(4)}`} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card-p">
          <h3 className="mb-4 font-semibold text-slate-900">Messages & Conversations</h3>
          <div className="h-64">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip formatter={(value, name) => [value, name === 'messages' ? 'Messages' : 'Conversations']} />
                  <Line type="monotone" dataKey="messages" stroke="#4f46e5" strokeWidth={2} dot={{ r: 3 }} name="Messages" />
                  <Line type="monotone" dataKey="conversations" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} name="Conversations" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">No data available</div>
            )}
          </div>
        </div>

        <div className="card-p">
          <h3 className="mb-4 font-semibold text-slate-900">Tokens & Cost</h3>
          <div className="h-64">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip />
                  <Bar dataKey="tokens" yAxisId="left" fill="#4f46e5" name="Tokens" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="cost" yAxisId="right" fill="#f59e0b" name="Cost ($)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">No data available</div>
            )}
          </div>
        </div>
      </div>

      {/* Usage table */}
      <div className="card overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-3">
          <h3 className="font-semibold text-slate-900">Usage Over Time</h3>
        </div>
        {usage.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-400">No usage data available yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Messages</th>
                  <th className="px-5 py-3">Tokens</th>
                  <th className="px-5 py-3">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {usage.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 text-slate-900">{new Date(record.date).toLocaleDateString()}</td>
                    <td className="px-5 py-3 text-slate-600">{record.messages}</td>
                    <td className="px-5 py-3 text-slate-600">{record.tokens.toLocaleString()}</td>
                    <td className="px-5 py-3 text-slate-600">${(record.cost || 0).toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
