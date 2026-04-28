import React, { useState } from 'react';

const fmt  = (n) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);
const fmtC = (n) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0,notation:'compact'}).format(n);

export default function VendorTable({ vendors, onSelectVendor, selectedVendor }) {
  const [sort,    setSort]    = useState({ key:'spend', dir:'desc' });
  const [search,  setSearch]  = useState('');

  const filtered = (vendors||[]).filter(v =>
    !search || v.vendor.toLowerCase().includes(search.toLowerCase()) ||
    v.top_category.toLowerCase().includes(search.toLowerCase())
  );
  const sorted = [...filtered].sort((a,b) => {
    const [va,vb] = [a[sort.key], b[sort.key]];
    if (typeof va === 'string') return sort.dir==='asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    return sort.dir==='asc' ? va-vb : vb-va;
  });
  const handleSort = (key) => setSort(s => ({ key, dir: s.key===key && s.dir==='desc' ? 'asc':'desc' }));
  const maxSpend = Math.max(...(vendors||[]).map(v=>v.spend),1);

  const cols = [
    {key:'vendor',    label:'Vendor'},
    {key:'spend',     label:'Total Spend'},
    {key:'txn_count', label:'Txns'},
    {key:'avg_txn',   label:'Avg Txn'},
    {key:'pct_of_total', label:'% of Total'},
    {key:'top_category', label:'Top Category'},
    {key:'last_date', label:'Last Date'},
  ];

  return (
    <div className="glass-card animate-slide-up">
      <div style={{ padding:'16px 20px', borderBottom:'1px solid #1e293b', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h2 className="text-white font-semibold" style={{ fontFamily:'DM Serif Display',fontSize:'1.05rem' }}>Vendor Spend</h2>
          <p className="text-slate-500 text-xs font-mono mt-0.5">Click a vendor to filter the dashboard</p>
        </div>
        <div style={{ position:'relative' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            style={{ position:'absolute',left:9,top:'50%',transform:'translateY(-50%)',color:'#475569',pointerEvents:'none' }}>
            <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
            <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <input type="text" placeholder="Search vendors…" value={search} onChange={e=>setSearch(e.target.value)}
            style={{ padding:'6px 10px 6px 28px',borderRadius:8,fontSize:12,
              background:'#0f172a',border:'1px solid #334155',color:'#cbd5e1',outline:'none',width:180 }} />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full data-table">
          <thead>
            <tr>
              <th style={{ paddingLeft:20 }}>#</th>
              {cols.map(c => (
                <th key={c.key} className="cursor-pointer select-none group text-left"
                  onClick={() => handleSort(c.key)}>
                  <span className="flex items-center gap-1 group-hover:text-slate-300 transition-colors">
                    {c.label}
                    <span style={{ color:'#475569' }}>{sort.key===c.key ? (sort.dir==='asc'?'↑':'↓') : '↕'}</span>
                  </span>
                </th>
              ))}
              <th>Bar</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((v, i) => {
              const isSelected = selectedVendor === v.vendor;
              return (
                <tr key={v.vendor} onClick={() => onSelectVendor(isSelected ? null : v.vendor)}
                  style={{ cursor:'pointer', background: isSelected ? 'rgba(56,189,248,0.06)' : 'transparent',
                    outline: isSelected ? '1px solid rgba(56,189,248,0.2)' : 'none' }}>
                  <td style={{ paddingLeft:20 }}>
                    <span className="text-slate-600 font-mono text-xs">{String(i+1).padStart(2,'0')}</span>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div style={{ width:28,height:28,borderRadius:8,flexShrink:0,
                        background:`hsl(${(v.vendor.charCodeAt(0)*47)%360},35%,18%)`,
                        border:`1px solid hsl(${(v.vendor.charCodeAt(0)*47)%360},35%,28%)`,
                        display:'flex',alignItems:'center',justifyContent:'center',
                        fontSize:12,fontWeight:700,
                        color:`hsl(${(v.vendor.charCodeAt(0)*47)%360},60%,65%)` }}>
                        {v.vendor.charAt(0)}
                      </div>
                      <span className="text-white text-sm font-medium whitespace-nowrap">{v.vendor}</span>
                    </div>
                  </td>
                  <td><span className="font-mono text-sm font-semibold text-rose-400">{fmt(v.spend)}</span></td>
                  <td><span className="font-mono text-sm text-slate-300">{v.txn_count}</span></td>
                  <td><span className="font-mono text-sm text-slate-400">{fmt(v.avg_txn)}</span></td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div style={{ width:48,height:4,borderRadius:2,background:'#1e293b',overflow:'hidden' }}>
                        <div style={{ height:'100%',borderRadius:2,background:'linear-gradient(90deg,#38bdf8,#818cf8)',
                          width:`${v.pct_of_total}%` }} />
                      </div>
                      <span className="font-mono text-xs" style={{ color:'#38bdf8' }}>{v.pct_of_total}%</span>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize:11,padding:'2px 8px',borderRadius:6,
                      background:'rgba(196,181,253,0.1)',color:'#c4b5fd',
                      border:'1px solid rgba(196,181,253,0.2)',whiteSpace:'nowrap' }}>
                      {v.top_category}
                    </span>
                  </td>
                  <td><span className="font-mono text-xs text-slate-500">{v.last_date}</span></td>
                  <td style={{ paddingRight:16 }}>
                    <div style={{ height:6,borderRadius:3,background:'#1e293b',width:80,overflow:'hidden' }}>
                      <div style={{ height:'100%',borderRadius:3,
                        background:'linear-gradient(90deg,#fb7185,#f43f5e)',
                        width:`${(v.spend/maxSpend)*100}%` }} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div className="text-center py-10 text-slate-500 text-sm">No vendors match your search.</div>
        )}
      </div>
    </div>
  );
}
