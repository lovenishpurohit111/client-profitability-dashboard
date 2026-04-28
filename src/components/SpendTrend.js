import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const fmtC = (n) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0,notation:'compact'}).format(n);
const fmt  = (n) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);

const Tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'#0f172a',border:'1px solid #334155',borderRadius:10,padding:'10px 14px' }}>
      <p style={{ color:'#64748b',fontSize:11,fontFamily:'JetBrains Mono',marginBottom:6 }}>{label}</p>
      <p style={{ color:'#fb7185',fontFamily:'JetBrains Mono',fontWeight:700,fontSize:14 }}>{fmt(payload[0].value)}</p>
      <p style={{ color:'#64748b',fontSize:11,marginTop:2 }}>{payload[1]?.value} transactions</p>
    </div>
  );
};

export default function SpendTrend({ trend }) {
  if (!trend?.length) return null;
  const max = Math.max(...trend.map(t=>t.spend),1);

  return (
    <div className="glass-card p-6 animate-slide-up">
      <div className="mb-4">
        <h2 className="text-white font-semibold" style={{ fontFamily:'DM Serif Display',fontSize:'1.05rem' }}>
          📈 Monthly Spend Trend
        </h2>
        <p className="text-slate-500 text-xs font-mono mt-0.5">Expense volume over time</p>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={trend} margin={{ top:4,right:4,left:-10,bottom:0 }} barSize={28}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false}/>
          <XAxis dataKey="month" tick={{ fill:'#64748b',fontSize:11,fontFamily:'JetBrains Mono' }}
            axisLine={{ stroke:'#1e293b' }} tickLine={false}/>
          <YAxis tickFormatter={fmtC} tick={{ fill:'#64748b',fontSize:10,fontFamily:'JetBrains Mono' }}
            axisLine={false} tickLine={false}/>
          <Tooltip content={<Tip />} cursor={{ fill:'rgba(51,65,85,0.3)' }}/>
          <Bar dataKey="spend" radius={[5,5,0,0]}>
            {trend.map((t,i) => (
              <Cell key={i} fill={t.spend === max
                ? 'url(#peakGrad)' : 'url(#normalGrad)'} />
            ))}
          </Bar>
          <Bar dataKey="transactions" hide/>
          <defs>
            <linearGradient id="normalGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fb7185" stopOpacity={0.9}/>
              <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.6}/>
            </linearGradient>
            <linearGradient id="peakGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fbbf24" stopOpacity={1}/>
              <stop offset="100%" stopColor="#f97316" stopOpacity={0.8}/>
            </linearGradient>
          </defs>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs text-slate-600 text-right mt-1 font-mono">
        ● Highest spend month highlighted in amber
      </p>
    </div>
  );
}
