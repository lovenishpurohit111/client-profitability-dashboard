import React from 'react';

const fmt = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

function Card({ label, value, sub, color, icon, delay }) {
  return (
    <div
      className="glass-card p-6 animate-slide-up"
      style={{ animationDelay: delay, animationFillMode: 'both' }}
    >
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
          style={{ background: color.bg, border: `1px solid ${color.border}` }}
        >
          {icon}
        </div>
        <div
          className="text-xs font-mono px-2 py-1 rounded-full"
          style={{ background: color.badgeBg, color: color.text, border: `1px solid ${color.border}` }}
        >
          {sub}
        </div>
      </div>
      <p className="text-slate-400 text-xs font-mono uppercase tracking-wider mb-2">{label}</p>
      <p
        className="text-2xl font-bold count-animate"
        style={{ fontFamily: 'JetBrains Mono', color: color.text }}
      >
        {value}
      </p>
    </div>
  );
}

export default function SummaryCards({ summary }) {
  const margin = summary.profit_margin;
  const isProfit = summary.net_profit >= 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card
        label="Total Revenue"
        value={fmt(summary.total_revenue)}
        sub="Gross Income"
        icon="💰"
        color={{
          bg: 'rgba(52, 211, 153, 0.1)',
          border: 'rgba(52, 211, 153, 0.2)',
          badgeBg: 'rgba(52, 211, 153, 0.08)',
          text: '#34d399',
        }}
        delay="0.1s"
      />
      <Card
        label="Total Expenses"
        value={fmt(summary.total_expenses)}
        sub="All Costs"
        icon="💸"
        color={{
          bg: 'rgba(251, 113, 133, 0.1)',
          border: 'rgba(251, 113, 133, 0.2)',
          badgeBg: 'rgba(251, 113, 133, 0.08)',
          text: '#fb7185',
        }}
        delay="0.2s"
      />
      <Card
        label="Net Profit"
        value={fmt(summary.net_profit)}
        sub={isProfit ? '▲ Positive' : '▼ Negative'}
        icon={isProfit ? '📈' : '📉'}
        color={
          isProfit
            ? {
                bg: 'rgba(52, 211, 153, 0.1)',
                border: 'rgba(52, 211, 153, 0.2)',
                badgeBg: 'rgba(52, 211, 153, 0.08)',
                text: '#34d399',
              }
            : {
                bg: 'rgba(251, 113, 133, 0.1)',
                border: 'rgba(251, 113, 133, 0.2)',
                badgeBg: 'rgba(251, 113, 133, 0.08)',
                text: '#fb7185',
              }
        }
        delay="0.3s"
      />
      <Card
        label="Profit Margin"
        value={`${margin.toFixed(1)}%`}
        sub={margin >= 30 ? '✦ Excellent' : margin >= 15 ? '◎ Good' : '◯ Low'}
        icon="🎯"
        color={
          margin >= 30
            ? {
                bg: 'rgba(34, 211, 238, 0.1)',
                border: 'rgba(34, 211, 238, 0.2)',
                badgeBg: 'rgba(34, 211, 238, 0.08)',
                text: '#22d3ee',
              }
            : margin >= 15
            ? {
                bg: 'rgba(251, 191, 36, 0.1)',
                border: 'rgba(251, 191, 36, 0.2)',
                badgeBg: 'rgba(251, 191, 36, 0.08)',
                text: '#fbbf24',
              }
            : {
                bg: 'rgba(251, 113, 133, 0.1)',
                border: 'rgba(251, 113, 133, 0.2)',
                badgeBg: 'rgba(251, 113, 133, 0.08)',
                text: '#fb7185',
              }
        }
        delay="0.4s"
      />
    </div>
  );
}
