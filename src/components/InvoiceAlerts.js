import React, { useState } from 'react';

const STATUS_CONFIG = {
  overdue:  { label: 'Overdue',  color: '#fb7185', bg: 'rgba(251,113,133,0.08)', border: 'rgba(251,113,133,0.2)',  icon: '🔴' },
  warning:  { label: 'Warning',  color: '#fbbf24', bg: 'rgba(251,191,36,0.08)',  border: 'rgba(251,191,36,0.2)',   icon: '🟡' },
  inactive: { label: 'Inactive', color: '#94a3b8', bg: 'rgba(148,163,184,0.06)', border: 'rgba(148,163,184,0.15)', icon: '⚫' },
};

const fmt = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0, notation: 'compact' }).format(n);

export default function InvoiceAlerts({ alerts = [] }) {
  const [collapsed, setCollapsed] = useState(false);

  if (!alerts.length) return null;

  const overdue  = alerts.filter(a => a.status === 'overdue').length;
  const warning  = alerts.filter(a => a.status === 'warning').length;
  const inactive = alerts.filter(a => a.status === 'inactive').length;

  return (
    <div className="glass-card animate-slide-up" style={{ border: '1px solid rgba(251,113,133,0.2)' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between p-5 cursor-pointer"
        onClick={() => setCollapsed(!collapsed)}
        style={{ borderBottom: collapsed ? 'none' : '1px solid rgba(30,41,59,0.8)' }}
      >
        <div className="flex items-center gap-3">
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'rgba(251,113,133,0.12)',
            border: '1px solid rgba(251,113,133,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16,
          }}>🔔</div>
          <div>
            <h3 className="text-white font-semibold" style={{ fontFamily: 'DM Serif Display', fontSize: '1rem' }}>
              Invoice Aging Alerts
            </h3>
            <p className="text-slate-500 text-xs font-mono mt-0.5">
              {alerts.length} client{alerts.length > 1 ? 's' : ''} need attention
            </p>
          </div>

          {/* Pill counts */}
          <div className="flex gap-2 ml-2">
            {overdue > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                style={{ background: 'rgba(251,113,133,0.15)', color: '#fb7185', border: '1px solid rgba(251,113,133,0.3)' }}>
                {overdue} Overdue
              </span>
            )}
            {warning > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)' }}>
                {warning} Warning
              </span>
            )}
            {inactive > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                style={{ background: 'rgba(148,163,184,0.08)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.2)' }}>
                {inactive} Inactive
              </span>
            )}
          </div>
        </div>

        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          style={{ color: '#475569', transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.2s' }}
        >
          <polyline points="6 9 12 15 18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {/* Alert rows */}
      {!collapsed && (
        <div className="divide-y" style={{ borderColor: 'rgba(30,41,59,0.5)' }}>
          {alerts.map((alert, i) => {
            const cfg = STATUS_CONFIG[alert.status] || STATUS_CONFIG.warning;
            return (
              <div key={i} className="flex items-center justify-between px-5 py-4 hover:bg-slate-800/20 transition-colors">
                <div className="flex items-center gap-3">
                  <span style={{ fontSize: 14 }}>{cfg.icon}</span>
                  <div>
                    <p className="text-white text-sm font-medium">{alert.client}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#64748b', fontFamily: 'JetBrains Mono' }}>
                      Last invoice: {alert.last_invoice_date === 'Never' ? 'Never' : alert.last_invoice_date}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-xs text-slate-500 font-mono">Last Revenue</p>
                    <p className="text-sm font-mono font-semibold text-slate-300">{fmt(alert.revenue)}</p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-slate-500 font-mono">Days Ago</p>
                    <p className="text-sm font-mono font-bold" style={{ color: cfg.color }}>
                      {alert.days_since_invoice === 9999 ? '—' : alert.days_since_invoice}
                    </p>
                  </div>

                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
                    style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                    {cfg.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tip */}
      {!collapsed && (
        <div className="px-5 py-3" style={{ borderTop: '1px solid rgba(30,41,59,0.5)' }}>
          <p className="text-xs text-slate-600">
            💡 <span className="text-slate-500">Warning = 30–60 days · Overdue = 60–90 days · Inactive = 90+ days since last revenue entry</span>
          </p>
        </div>
      )}
    </div>
  );
}
