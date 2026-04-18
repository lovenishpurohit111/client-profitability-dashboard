import React, { useState } from 'react';

const fmt = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

export default function ClientTable({ clients }) {
  const [sortKey, setSortKey] = useState('profit');
  const [sortDir, setSortDir] = useState('desc');

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sorted = [...clients].sort((a, b) => {
    const va = typeof a[sortKey] === 'string' ? a[sortKey].toLowerCase() : a[sortKey];
    const vb = typeof b[sortKey] === 'string' ? b[sortKey].toLowerCase() : b[sortKey];
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const cols = [
    { key: 'client', label: 'Client' },
    { key: 'revenue', label: 'Revenue' },
    { key: 'expenses', label: 'Expenses' },
    { key: 'profit', label: 'Profit' },
    { key: 'margin', label: 'Margin %' },
  ];

  const maxProfit = Math.max(...clients.map((c) => Math.abs(c.profit)), 1);

  return (
    <div className="overflow-x-auto">
      <table className="w-full data-table">
        <thead>
          <tr>
            <th className="text-left">#</th>
            {cols.map((col) => (
              <th
                key={col.key}
                className="text-left cursor-pointer select-none group"
                onClick={() => handleSort(col.key)}
              >
                <span className="flex items-center gap-1 group-hover:text-slate-300 transition-colors">
                  {col.label}
                  <span className="text-slate-600">
                    {sortKey === col.key ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                  </span>
                </span>
              </th>
            ))}
            <th className="text-left">Profitability</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => {
            const isPos = row.profit >= 0;
            const barWidth = Math.min((Math.abs(row.profit) / maxProfit) * 100, 100);

            return (
              <tr key={row.client}>
                <td className="text-slate-600 font-mono text-xs w-8">{String(i + 1).padStart(2, '0')}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                      style={{
                        background: `hsl(${(i * 47) % 360}, 40%, 20%)`,
                        color: `hsl(${(i * 47) % 360}, 70%, 70%)`,
                        border: `1px solid hsl(${(i * 47) % 360}, 40%, 30%)`,
                      }}
                    >
                      {row.client.charAt(0)}
                    </div>
                    <span className="text-white font-medium text-sm">{row.client}</span>
                  </div>
                </td>
                <td className="font-mono text-sm text-emerald-400">{fmt(row.revenue)}</td>
                <td className="font-mono text-sm text-rose-400">{fmt(row.expenses)}</td>
                <td className={`font-mono text-sm font-semibold ${isPos ? 'profit-positive' : 'profit-negative'}`}>
                  {isPos ? '+' : ''}{fmt(row.profit)}
                </td>
                <td>
                  <span
                    className="font-mono text-sm font-bold"
                    style={{ color: row.margin >= 30 ? '#22d3ee' : row.margin >= 15 ? '#fbbf24' : '#fb7185' }}
                  >
                    {row.margin.toFixed(1)}%
                  </span>
                </td>
                <td className="w-32">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-1.5 rounded-full flex-1 overflow-hidden"
                      style={{ background: '#1e293b' }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${barWidth}%`,
                          background: isPos
                            ? 'linear-gradient(90deg, #34d399, #22d3ee)'
                            : 'linear-gradient(90deg, #f43f5e, #fb7185)',
                        }}
                      />
                    </div>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {clients.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          No client data available for the selected filters.
        </div>
      )}
    </div>
  );
}
