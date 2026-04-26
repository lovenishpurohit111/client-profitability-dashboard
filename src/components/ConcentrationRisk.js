import React from 'react';

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

export default function ConcentrationRisk({ risk }) {
  if (!risk) return null;
  const level = risk.pct >= 60 ? 'critical' : risk.pct >= 45 ? 'high' : 'moderate';
  const cfg = {
    critical: { color: '#fb7185', bg: 'rgba(251,113,133,0.08)', border: 'rgba(251,113,133,0.3)', icon: '🚨', label: 'Critical Risk' },
    high:     { color: '#fbbf24', bg: 'rgba(251,191,36,0.08)',  border: 'rgba(251,191,36,0.3)',  icon: '⚠️', label: 'High Risk' },
    moderate: { color: '#f97316', bg: 'rgba(249,115,22,0.08)',  border: 'rgba(249,115,22,0.3)',  icon: '⚡', label: 'Moderate Risk' },
  }[level];

  return (
    <div style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 16, padding: '16px 20px',
      display: 'flex', alignItems: 'center', gap: 16, animationName: 'slideUp', animationDuration: '0.4s', animationFillMode: 'both' }}>
      <div style={{ fontSize: 22, flexShrink: 0 }}>{cfg.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, fontFamily: 'JetBrains Mono',
            textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {cfg.label}: Revenue Concentration
          </span>
        </div>
        <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.4 }}>
          <span style={{ color: cfg.color, fontWeight: 600 }}>{risk.client}</span> accounts for{' '}
          <span style={{ color: cfg.color, fontWeight: 700 }}>{risk.pct}%</span> of total revenue ({fmt(risk.revenue)}).
          Losing this client would be catastrophic. Actively diversify your client base.
        </p>
      </div>
      <div style={{ flexShrink: 0, textAlign: 'center' }}>
        <div style={{ fontSize: 28, fontFamily: 'JetBrains Mono', fontWeight: 700, color: cfg.color, lineHeight: 1 }}>
          {risk.pct}%
        </div>
        <div style={{ fontSize: 10, color: '#64748b', fontFamily: 'JetBrains Mono', marginTop: 2 }}>concentration</div>
      </div>
    </div>
  );
}
