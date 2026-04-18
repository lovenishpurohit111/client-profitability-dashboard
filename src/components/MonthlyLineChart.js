import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts';

const fmt = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0, notation: 'compact' }).format(n);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#0f172a', border: '1px solid #334155',
      borderRadius: 10, padding: '10px 14px', fontFamily: 'DM Sans', minWidth: 140,
    }}>
      <p style={{ color: '#64748b', fontSize: 11, fontFamily: 'JetBrains Mono', marginBottom: 8 }}>{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4 mb-1">
          <span style={{ color: p.color, fontSize: 12 }}>{p.name}</span>
          <span style={{ color: p.color, fontSize: 13, fontFamily: 'JetBrains Mono', fontWeight: 700 }}>
            {fmt(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function MonthlyLineChart({ trend }) {
  if (!trend.length) return <div className="text-slate-500 text-sm text-center py-8">No trend data</div>;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={trend} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="revenueGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'JetBrains Mono' }}
          axisLine={{ stroke: '#1e293b' }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={fmt}
          tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'JetBrains Mono' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ paddingTop: 16, fontFamily: 'DM Sans', fontSize: 12 }}
          formatter={(value) => <span style={{ color: '#94a3b8' }}>{value}</span>}
        />
        <ReferenceLine y={0} stroke="#334155" strokeDasharray="4 4" />
        <Line
          type="monotone"
          dataKey="revenue"
          name="Revenue"
          stroke="#34d399"
          strokeWidth={2.5}
          dot={{ fill: '#34d399', r: 4, strokeWidth: 0 }}
          activeDot={{ r: 6, fill: '#34d399', stroke: '#0f172a', strokeWidth: 2 }}
        />
        <Line
          type="monotone"
          dataKey="expenses"
          name="Expenses"
          stroke="#fb7185"
          strokeWidth={2.5}
          dot={{ fill: '#fb7185', r: 4, strokeWidth: 0 }}
          activeDot={{ r: 6, fill: '#fb7185', stroke: '#0f172a', strokeWidth: 2 }}
        />
        <Line
          type="monotone"
          dataKey="profit"
          name="Profit"
          stroke="#22d3ee"
          strokeWidth={2.5}
          strokeDasharray="6 3"
          dot={{ fill: '#22d3ee', r: 4, strokeWidth: 0 }}
          activeDot={{ r: 6, fill: '#22d3ee', stroke: '#0f172a', strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
