import React from 'react';
const fmt = (n) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);
const fmtC = (n) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0,notation:'compact'}).format(n);

function Card({ icon, label, value, sub, color, bg, border, delay }) {
  return (
    <div className="glass-card p-5 animate-slide-up" style={{ animationDelay: delay, animationFillMode:'both' }}>
      <div className="flex items-start justify-between mb-3">
        <div style={{ width:38,height:38,borderRadius:10,background:bg,border:`1px solid ${border}`,
          display:'flex',alignItems:'center',justifyContent:'center',fontSize:17 }}>{icon}</div>
        {sub && <span style={{ fontSize:11,padding:'2px 8px',borderRadius:12,
          background:bg,color:color,border:`1px solid ${border}`,fontFamily:'JetBrains Mono' }}>{sub}</span>}
      </div>
      <p className="text-slate-500 text-xs font-mono uppercase tracking-wider mb-1">{label}</p>
      <p style={{ fontFamily:'JetBrains Mono',fontWeight:700,fontSize:'1.4rem',color,lineHeight:1 }}>{value}</p>
    </div>
  );
}

export default function SummaryCards({ summary }) {
  if (!summary) return null;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card icon="💸" label="Total Spend" value={fmtC(summary.total_spend)} sub="All vendors"
        color="#fb7185" bg="rgba(251,113,133,0.1)" border="rgba(251,113,133,0.25)" delay="0.05s" />
      <Card icon="🏪" label="Vendors" value={summary.vendor_count} sub="Active"
        color="#38bdf8" bg="rgba(56,189,248,0.1)" border="rgba(56,189,248,0.25)" delay="0.1s" />
      <Card icon="📋" label="Transactions" value={summary.transaction_count} sub={`avg ${fmt(summary.avg_transaction)}`}
        color="#c4b5fd" bg="rgba(196,181,253,0.1)" border="rgba(196,181,253,0.25)" delay="0.15s" />
      <Card icon="📅" label="Monthly Avg" value={fmtC(summary.monthly_avg)} sub="Per month"
        color="#34d399" bg="rgba(52,211,153,0.1)" border="rgba(52,211,153,0.25)" delay="0.2s" />
    </div>
  );
}
