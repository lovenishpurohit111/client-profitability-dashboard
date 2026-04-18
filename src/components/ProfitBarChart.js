import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';

const fmt = (n) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    maximumFractionDigits: 0, notation: 'compact',
  }).format(n);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value;
  return (
    <div style={{
      background: '#0f172a', border: '1px solid #334155',
      borderRadius: 10, padding: '10px 14px', fontFamily: 'DM Sans',
    }}>
      <p style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>{label}</p>
      <p style={{
        color: val >= 0 ? '#34d399' : '#fb7185',
        fontSize: 15, fontFamily: 'JetBrains Mono', fontWeight: 700,
      }}>
        {val >= 0 ? '+' : ''}{fmt(val)}
      </p>
    </div>
  );
};

export default function ProfitBarChart({ clients }) {
  const data = clients.map((c) => ({ name: c.client, profit: c.profit }));

  if (!data.length) return <div className="text-slate-500 text-sm text-center py-8">No data</div>;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -10, bottom: 0 }} barSize={32}>
        <defs>
          <linearGradient id="profitGradPos" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34d399" stopOpacity={1} />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity={1} />
          </linearGradient>
          <linearGradient id="profitGradNeg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fb7185" stopOpacity={1} />
            <stop offset="100%" stopColor="#f43f5e" stopOpacity={1} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'DM Sans' }}
          axisLine={{ stroke: '#1e293b' }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={fmt}
          tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'JetBrains Mono' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(51,65,85,0.3)' }} />
        <Bar dataKey="profit" radius={[6, 6, 0, 0]}>
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={entry.profit >= 0 ? 'url(#profitGradPos)' : 'url(#profitGradNeg)'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
