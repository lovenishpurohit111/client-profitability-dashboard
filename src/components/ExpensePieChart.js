import React, { useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const COLORS = [
  '#34d399', '#22d3ee', '#fbbf24', '#fb7185', '#a78bfa',
  '#f97316', '#38bdf8', '#4ade80', '#e879f9', '#facc15',
];

const fmt = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0, notation: 'compact' }).format(n);

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div style={{
      background: '#0f172a', border: '1px solid #334155',
      borderRadius: 10, padding: '10px 14px', fontFamily: 'DM Sans',
    }}>
      <p style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>{name}</p>
      <p style={{ color: payload[0].payload.fill, fontSize: 15, fontFamily: 'JetBrains Mono', fontWeight: 700 }}>
        {fmt(value)}
      </p>
    </div>
  );
};

const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.06) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central"
      style={{ fontSize: 11, fontFamily: 'JetBrains Mono', fontWeight: 700 }}>
      {(percent * 100).toFixed(0)}%
    </text>
  );
};

export default function ExpensePieChart({ breakdown }) {
  const data = breakdown.map((b, i) => ({
    name: b.category,
    value: b.amount,
    fill: COLORS[i % COLORS.length],
  }));

  if (!data.length) return <div className="text-slate-500 text-sm text-center py-8">No expense data</div>;

  return (
    <div>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={3}
            dataKey="value"
            labelLine={false}
            label={renderCustomizedLabel}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.fill} stroke="rgba(0,0,0,0.2)" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="mt-2 space-y-1 max-h-28 overflow-y-auto pr-1">
        {data.map((d, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.fill }} />
              <span className="text-slate-400 truncate">{d.name}</span>
            </div>
            <span className="font-mono text-slate-300 ml-2 flex-shrink-0">{fmt(d.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
