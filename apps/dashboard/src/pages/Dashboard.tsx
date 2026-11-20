import { useQuery } from '@tanstack/react-query';
import { Activity, AlertTriangle, Boxes, CheckCircle2, Gauge, Link2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../api';
import { CodeBadge, Empty, PageHead, StatusBadge } from '../components/ui';
import { number, timeAgo } from '../format';
import { DailyPoint, Delivery, Page, Stats } from '../types';

type Series = 'all' | 'succeeded' | 'failed';

export function Dashboard() {
  const stats = useQuery({ queryKey: ['stats'], queryFn: () => api<Stats>('/v1/stats') });
  const daily = useQuery({
    queryKey: ['stats', 'daily'],
    queryFn: () => api<DailyPoint[]>('/v1/stats/daily?days=7'),
  });
  const recent = useQuery({
    queryKey: ['deliveries', 'recent'],
    queryFn: () => api<Page<Delivery>>('/v1/deliveries?limit=6'),
  });
  const [series, setSeries] = useState<Series>('all');
  const s = stats.data;

  const cards = [
    { label: 'Total deliveries (24h)', value: number(s?.total), note: 'Webhook deliveries created in the last 24 hours', icon: Activity },
    {
      label: 'Successful (24h)',
      value: number(s?.succeeded),
      note: s?.successRate === null || !s ? 'No finished deliveries yet' : `${s.successRate}% success rate`,
      icon: CheckCircle2,
    },
    { label: 'Failed (24h)', value: number(s?.failed), note: 'Dead-lettered after all retries', icon: AlertTriangle },
    { label: 'Active endpoints', value: number(s?.activeEndpoints), note: 'Enabled endpoints receiving events', icon: Link2 },
    { label: 'Applications', value: number(s?.applications), note: 'Registered event sources', icon: Boxes },
    {
      label: 'Latency P50',
      value: s?.latencyP50Ms === null || !s ? '—' : `${s.latencyP50Ms}ms`,
      note: s?.latencyP95Ms ? `P95 ${s.latencyP95Ms}ms over the last 24h` : 'Median endpoint response time',
      icon: Gauge,
    },
  ];

  return (
    <>
      <PageHead title="Dashboard" subtitle="Overview of your webhook delivery system" />
      <div className="grid-3">
        {cards.map(({ label, value, note, icon: Icon }) => (
          <div className="card" key={label}>
            <div className="stat-head">
              {label}
              <Icon size={16} />
            </div>
            <div className="stat-value">{value}</div>
            <div className="stat-note">{note}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="spread">
          <div>
            <h2>Delivery overview</h2>
            <p className="sub">Webhook deliveries over the last 7 days (UTC)</p>
          </div>
          <div className="segmented">
            {(['all', 'succeeded', 'failed'] as Series[]).map((key) => (
              <button key={key} className={series === key ? 'on' : ''} onClick={() => setSeries(key)}>
                {key === 'all' ? 'All' : key === 'succeeded' ? 'Succeeded' : 'Failed'}
              </button>
            ))}
          </div>
        </div>
        <div style={{ height: 260, marginTop: 16 }}>
          <ResponsiveContainer>
            <AreaChart data={daily.data ?? []} margin={{ left: -16, right: 8 }}>
              <defs>
                <linearGradient id="ok" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="bad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#26262c" vertical={false} />
              <XAxis dataKey="date" stroke="#8d8d99" fontSize={12} tickFormatter={(d: string) => d.slice(5)} />
              <YAxis stroke="#8d8d99" fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#17171b', border: '1px solid #26262c', borderRadius: 8 }} />
              {series !== 'failed' && (
                <Area type="monotone" dataKey="succeeded" name="Succeeded" stroke="#22c55e" fill="url(#ok)" strokeWidth={2} isAnimationActive={false} />
              )}
              {series !== 'succeeded' && (
                <Area type="monotone" dataKey="failed" name="Failed" stroke="#ef4444" fill="url(#bad)" strokeWidth={2} isAnimationActive={false} />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="spread">
          <div>
            <h2>Recent deliveries</h2>
            <p className="sub">Updates live as attempts finish</p>
          </div>
          <Link className="btn sm" to="/deliveries">
            View all
          </Link>
        </div>
        {recent.data?.data.length === 0 ? (
          <Empty title="No deliveries yet">Publish a message to an application to see it here.</Empty>
        ) : (
          <table style={{ marginTop: 8 }}>
            <tbody>
              {recent.data?.data.map((d) => (
                <tr key={d.id}>
                  <td><StatusBadge status={d.status} /></td>
                  <td className="mono">{d.message.eventType}</td>
                  <td className="truncate muted">{d.endpoint.url}</td>
                  <td><CodeBadge code={d.lastStatusCode} /></td>
                  <td className="muted num">{timeAgo(d.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
