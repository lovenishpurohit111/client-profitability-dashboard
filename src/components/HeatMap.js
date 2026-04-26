import React, { useState } from 'react';

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD',
  maximumFractionDigits: 0, notation: 'compact' }).format(n);

function cellColor(value, maxAbs) {
  if (value === undefined || value === null) return { bg: '#0f172a', text: '#334155' };
  if (maxAbs === 0) return { bg: '#1e293b', text: '#64748b' };
  const ratio = Math.max(-1, Math.min(1, value / maxAbs));
  if (ratio > 0) {
    const intensity = ratio;
    return {
      bg: `rgba(52,211,153,${0.08 + intensity * 0.55})`,
      text: intensity > 0.4 ? '#fff' : '#34d399',
    };
  } else if (ratio < 0) {
    const intensity = Math.abs(ratio);
    return {
      bg: `rgba(251,113,133,${0.08 + intensity * 0.55})`,
      text: intensity > 0.4 ? '#fff' : '#fb7185',
    };
  }
  return { bg: '#1e293b', text: '#64748b' };
}

export default function HeatMap({ heatmap }) {
  const [tooltip, setTooltip] = useState(null);

  if (!heatmap || !heatmap.months || heatmap.months.length === 0) return null;
  const { months, clients, data } = heatmap;

  // Compute max absolute profit for colour scaling
  const allValues = clients.flatMap(c => months.map(m => data[c]?.[m] ?? 0));
  const maxAbs = Math.max(...allValues.map(Math.abs), 1);

  return (
    <div className="glass-card p-6 animate-slide-up" style={{ overflowX: 'auto' }}>
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <span>🌡️</span>
          <h2 className="text-white font-semibold" style={{ fontFamily: 'DM Serif Display', fontSize: '1.1rem' }}>
            Profitability Heatmap
          </h2>
        </div>
        <p className="text-slate-500 text-xs font-mono">Profit per client per month — green is profit, red is loss</p>
      </div>

      <div style={{ position: 'relative', minWidth: months.length * 70 + 160 }}>
        {/* Month headers */}
        <div style={{ display: 'flex', marginLeft: 150, marginBottom: 6 }}>
          {months.map(m => (
            <div key={m} style={{ width: 70, textAlign: 'center', fontSize: 10,
              fontFamily: 'JetBrains Mono', color: '#64748b', flexShrink: 0 }}>
              {m.slice(5)} {/* show MM only */}
            </div>
          ))}
        </div>

        {/* Rows */}
        {clients.map((client, ci) => (
          <div key={client} style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
            {/* Client label */}
            <div style={{ width: 150, paddingRight: 12, textAlign: 'right', fontSize: 12,
              color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              flexShrink: 0, fontFamily: 'DM Sans' }}>
              {client}
            </div>
            {/* Cells */}
            {months.map(m => {
              const val = data[client]?.[m];
              const { bg, text } = cellColor(val, maxAbs);
              return (
                <div
                  key={m}
                  style={{ width: 70, height: 36, margin: '0 1px', borderRadius: 6, background: bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontFamily: 'JetBrains Mono', fontWeight: 600, color: text,
                    cursor: 'default', flexShrink: 0, transition: 'filter 0.15s',
                    filter: tooltip?.client === client && tooltip?.month === m ? 'brightness(1.3)' : 'brightness(1)' }}
                  onMouseEnter={(e) => setTooltip({
                    client, month: m, value: val,
                    x: e.currentTarget.getBoundingClientRect().left,
                    y: e.currentTarget.getBoundingClientRect().top,
                  })}
                  onMouseLeave={() => setTooltip(null)}
                >
                  {val !== null && val !== undefined ? fmtTiny(val) : '—'}
                </div>
              );
            })}
          </div>
        ))}

        {/* Legend */}
        <div className="flex items-center gap-3 mt-4 justify-end">
          <span className="text-xs text-slate-600 font-mono">Loss</span>
          {[-1, -0.5, 0, 0.5, 1].map(r => {
            const { bg } = cellColor(r * maxAbs, maxAbs);
            return <div key={r} style={{ width: 20, height: 12, borderRadius: 3, background: bg }} />;
          })}
          <span className="text-xs text-slate-600 font-mono">Profit</span>
        </div>
      </div>

      {/* Tooltip portal-ish */}
      {tooltip && (
        <div style={{
          position: 'fixed',
          left: tooltip.x + 35,
          top: tooltip.y - 10,
          background: '#0f172a',
          border: '1px solid #334155',
          borderRadius: 8,
          padding: '8px 12px',
          zIndex: 9999,
          pointerEvents: 'none',
          fontSize: 12,
          fontFamily: 'DM Sans',
          boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
        }}>
          <p style={{ color: '#94a3b8', marginBottom: 4 }}>{tooltip.client} · {tooltip.month}</p>
          <p style={{
            fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 14,
            color: (tooltip.value ?? 0) >= 0 ? '#34d399' : '#fb7185'
          }}>
            {tooltip.value !== null && tooltip.value !== undefined
              ? `${tooltip.value >= 0 ? '+' : ''}${fmt(tooltip.value)}`
              : 'No data'}
          </p>
        </div>
      )}
    </div>
  );
}

function fmtTiny(n) {
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(0)}k`;
  return String(Math.round(n));
}
