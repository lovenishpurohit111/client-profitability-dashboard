import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const COLORS = ['#fb7185','#f97316','#fbbf24','#34d399','#22d3ee','#38bdf8',
                '#818cf8','#c4b5fd','#e879f9','#a78bfa','#6ee7b7','#67e8f9'];
const fmtC = (n) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0,notation:'compact'}).format(n);
const fmt  = (n) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);

const Tip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div style={{ background:'#0f172a',border:'1px solid #334155',borderRadius:10,padding:'10px 14px' }}>
      <p style={{ color:'#94a3b8',fontSize:12,marginBottom:4 }}>{name}</p>
      <p style={{ color:payload[0].payload.fill,fontFamily:'JetBrains Mono',fontWeight:700,fontSize:15 }}>{fmt(value)}</p>
    </div>
  );
};

const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI/180;
  const r = innerRadius + (outerRadius-innerRadius)*0.55;
  return (
    <text x={cx+r*Math.cos(-midAngle*RADIAN)} y={cy+r*Math.sin(-midAngle*RADIAN)}
      fill="white" textAnchor="middle" dominantBaseline="central"
      style={{ fontSize:11,fontFamily:'JetBrains Mono',fontWeight:700 }}>
      {(percent*100).toFixed(0)}%
    </text>
  );
};

export default function CategoryBreakdown({ categories }) {
  if (!categories?.length) return null;
  const data = categories.map((c,i) => ({ name:c.category, value:c.amount, fill:COLORS[i%COLORS.length] }));
  const total = categories.reduce((s,c)=>s+c.amount,0);

  return (
    <div className="glass-card p-6 animate-slide-up">
      <div className="mb-4">
        <h2 className="text-white font-semibold" style={{ fontFamily:'DM Serif Display',fontSize:'1.05rem' }}>
          📊 Spend by Category
        </h2>
        <p className="text-slate-500 text-xs font-mono mt-0.5">How expenses are distributed</p>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={95}
            paddingAngle={2} dataKey="value" labelLine={false} label={renderLabel}>
            {data.map((e,i) => <Cell key={i} fill={e.fill} stroke="rgba(0,0,0,0.2)" strokeWidth={2}/>)}
          </Pie>
          <Tooltip content={<Tip />}/>
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-3 space-y-1.5 max-h-36 overflow-y-auto pr-1">
        {data.map((d,i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <div style={{ width:8,height:8,borderRadius:'50%',background:d.fill,flexShrink:0 }}/>
              <span className="text-slate-400 truncate">{d.name}</span>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0 ml-2">
              <span style={{ color:'#64748b',fontFamily:'JetBrains Mono' }}>
                {(d.value/total*100).toFixed(1)}%
              </span>
              <span style={{ color:'#e2e8f0',fontFamily:'JetBrains Mono',fontWeight:600 }}>{fmtC(d.value)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
