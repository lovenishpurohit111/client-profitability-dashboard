import React, { useState } from 'react';
import Sparkline from './Sparkline';

const fmt = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

function HealthBadge({ health }) {
  if (!health) return null;
  return (
    <div className="flex items-center gap-1.5">
      <div style={{
        width: 28, height: 28, borderRadius: 8,
        background: `${health.color}18`,
        border: `1px solid ${health.color}40`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 13,
        color: health.color,
      }}>
        {health.grade}
      </div>
      <span style={{ color: health.color, fontSize: 11, fontFamily: 'DM Sans' }}>{health.label}</span>
    </div>
  );
}

function TrendBadge({ pct, dir }) {
  const isUp   = dir === 'up';
  const isDown = dir === 'down';
  const color  = isUp ? '#34d399' : isDown ? '#fb7185' : '#64748b';
  const arrow  = isUp ? '↑' : isDown ? '↓' : '→';
  return (
    <span className="font-mono text-xs font-semibold" style={{ color }}>
      {arrow} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

export default function ClientTable({ clients }) {
  const [sortKey, setSortKey] = useState('profit');
  const [sortDir, setSortDir] = useState('desc');

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const sorted = [...clients].sort((a, b) => {
    let va = a[sortKey], vb = b[sortKey];
    if (sortKey === 'health') { va = a.health?.score ?? 0; vb = b.health?.score ?? 0; }
    if (typeof va === 'string') { va = va.toLowerCase(); vb = vb.toLowerCase(); }
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const cols = [
    { key: 'client',   label: 'Client'   },
    { key: 'revenue',  label: 'Revenue'  },
    { key: 'expenses', label: 'Expenses' },
    { key: 'profit',   label: 'Profit'   },
    { key: 'margin',   label: 'Margin'   },
    { key: 'health',   label: 'Health'   },
    { key: 'trend_pct', label: 'MoM'     },
  ];

  const maxProfit = Math.max(...clients.map(c => Math.abs(c.profit)), 1);

  const invoiceColor = (status) => ({
    active:   '#34d399',
    warning:  '#fbbf24',
    overdue:  '#fb7185',
    inactive: '#64748b',
  }[status] || '#64748b');

  return (
    <div className="overflow-x-auto">
      <table className="w-full data-table">
        <thead>
          <tr>
            <th className="text-left" style={{ paddingLeft: 20 }}>#</th>
            {cols.map(col => (
              <th key={col.key} className="text-left cursor-pointer select-none group" onClick={() => handleSort(col.key)}>
                <span className="flex items-center gap-1 group-hover:text-slate-300 transition-colors">
                  {col.label}
                  <span className="text-slate-700">{sortKey === col.key ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
                </span>
              </th>
            ))}
            <th className="text-left">6-Month Trend</th>
            <th className="text-left">Last Invoice</th>
            <th className="text-left">Bar</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => {
            const isPos    = row.profit >= 0;
            const barWidth = Math.min((Math.abs(row.profit) / maxProfit) * 100, 100);
            const iColor   = invoiceColor(row.invoice_status);

            return (
              <tr key={row.client}>
                {/* # */}
                <td style={{ paddingLeft: 20 }}>
                  <span className="text-slate-600 font-mono text-xs">{String(i + 1).padStart(2, '0')}</span>
                </td>

                {/* Client */}
                <td>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ background: `hsl(${i * 47 % 360},40%,18%)`, color: `hsl(${i * 47 % 360},65%,65%)`, border: `1px solid hsl(${i * 47 % 360},40%,28%)` }}>
                      {row.client.charAt(0)}
                    </div>
                    <span className="text-white font-medium text-sm whitespace-nowrap">{row.client}</span>
                  </div>
                </td>

                {/* Revenue */}
                <td><span className="font-mono text-sm text-emerald-400">{fmt(row.revenue)}</span></td>

                {/* Expenses */}
                <td><span className="font-mono text-sm text-rose-400">{fmt(row.expenses)}</span></td>

                {/* Profit */}
                <td>
                  <span className={`font-mono text-sm font-semibold ${isPos ? 'profit-positive' : 'profit-negative'}`}>
                    {isPos ? '+' : ''}{fmt(row.profit)}
                  </span>
                </td>

                {/* Margin */}
                <td>
                  <span className="font-mono text-sm font-bold"
                    style={{ color: row.margin >= 30 ? '#22d3ee' : row.margin >= 15 ? '#fbbf24' : '#fb7185' }}>
                    {row.margin.toFixed(1)}%
                  </span>
                </td>

                {/* Health Score */}
                <td><HealthBadge health={row.health} /></td>

                {/* MoM Trend */}
                <td><TrendBadge pct={row.trend_pct} dir={row.trend_dir} /></td>

                {/* Sparkline */}
                <td>
                  <Sparkline data={row.sparkline} width={80} height={30} />
                </td>

                {/* Last Invoice */}
                <td>
                  <div>
                    <div className="font-mono text-xs" style={{ color: iColor }}>
                      {row.invoice_status === 'active' ? '● Active' :
                       row.invoice_status === 'warning' ? '● Warning' :
                       row.invoice_status === 'overdue' ? '● Overdue' : '● Inactive'}
                    </div>
                    <div className="text-slate-600 text-xs font-mono mt-0.5">
                      {row.days_since_invoice === 9999 ? 'Never' : `${row.days_since_invoice}d ago`}
                    </div>
                  </div>
                </td>

                {/* Profit bar */}
                <td className="w-24">
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#1e293b' }}>
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${barWidth}%`, background: isPos ? 'linear-gradient(90deg,#34d399,#22d3ee)' : 'linear-gradient(90deg,#f43f5e,#fb7185)' }} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {clients.length === 0 && (
        <div className="text-center py-12 text-slate-500">No client data for the selected filters.</div>
      )}
    </div>
  );
}
