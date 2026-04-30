import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import API from '../config';

const fmt = (n) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(n);

export default function TransactionLog({ vendor, categories, sessionId }) {
  const [txns,     setTxns]     = useState([]);
  const [total,    setTotal]    = useState(0);
  const [pages,    setPages]    = useState(1);
  const [page,     setPage]     = useState(0);
  const [search,   setSearch]   = useState('');
  const [catFilter,setCatFilter]= useState('All');
  const [loading,  setLoading]  = useState(false);

  const fetchTxns = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, page_size: 50, session_id: sessionId || '' };
      if (vendor && vendor !== 'All') params.vendor = vendor;
      if (catFilter !== 'All') params.category = catFilter;
      if (search) params.search = search;
      const res = await axios.get(`${API}/transactions`, { params });
      setTxns(res.data.transactions);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch { setTxns([]); }
    finally { setLoading(false); }
  }, [vendor, catFilter, search, page]);

  useEffect(() => { setPage(0); }, [vendor, catFilter, search]);
  useEffect(() => { fetchTxns(); }, [fetchTxns]);

  const catList = ['All', ...(categories || [])];

  return (
    <div className="glass-card animate-slide-up">
      {/* Header */}
      <div style={{ padding:'16px 20px',borderBottom:'1px solid #1e293b' }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-white font-semibold" style={{ fontFamily:'DM Serif Display',fontSize:'1.05rem' }}>
              🧾 Transaction Log
            </h2>
            <p className="text-slate-500 text-xs font-mono mt-0.5">{total} transactions</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div style={{ position:'relative' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                style={{ position:'absolute',left:8,top:'50%',transform:'translateY(-50%)',color:'#475569',pointerEvents:'none' }}>
                <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
                <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <input type="text" placeholder="Search…" value={search}
                onChange={e=>setSearch(e.target.value)}
                style={{ padding:'6px 8px 6px 26px',borderRadius:7,fontSize:12,
                  background:'#0f172a',border:'1px solid #334155',color:'#cbd5e1',outline:'none',width:150 }}/>
            </div>
            {/* Category filter */}
            <select value={catFilter} onChange={e=>setCatFilter(e.target.value)}
              style={{ padding:'6px 10px',borderRadius:7,fontSize:12,
                background:'#0f172a',border:'1px solid #334155',color:'#cbd5e1',outline:'none' }}>
              {catList.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="text-center py-10 text-slate-500 text-sm">Loading…</div>
        ) : (
          <table style={{ width:'100%',borderCollapse:'collapse' }}>
            <thead>
              <tr>
                {['Date','Vendor','Memo','Category','Amount'].map(h=>(
                  <th key={h} style={{ padding:'10px 16px',textAlign:h==='Amount'?'right':'left',
                    fontSize:10,fontFamily:'JetBrains Mono',color:'#475569',textTransform:'uppercase',
                    letterSpacing:'0.08em',borderBottom:'1px solid #1e293b',whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {txns.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign:'center',padding:28,color:'#475569',fontSize:13 }}>No transactions match.</td></tr>
              ) : txns.map((t,i) => (
                <tr key={i} style={{ borderBottom:'1px solid rgba(30,41,59,0.5)',
                  background:i%2===0?'transparent':'rgba(15,23,42,0.3)' }}>
                  <td style={{ padding:'10px 16px',fontFamily:'JetBrains Mono',fontSize:12,color:'#64748b',whiteSpace:'nowrap' }}>{t.date}</td>
                  <td style={{ padding:'10px 16px',fontSize:13,color:'#e2e8f0',fontWeight:500,whiteSpace:'nowrap' }}>{t.vendor}</td>
                  <td style={{ padding:'10px 16px',fontSize:12,color:'#94a3b8',maxWidth:260,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}
                    title={t.memo}>{t.memo || '—'}</td>
                  <td style={{ padding:'10px 16px' }}>
                    <span style={{ fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:6,
                      background:'rgba(196,181,253,0.1)',color:'#c4b5fd',
                      border:'1px solid rgba(196,181,253,0.2)',whiteSpace:'nowrap' }}>
                      {t.category}
                    </span>
                  </td>
                  <td style={{ padding:'10px 16px',textAlign:'right',fontFamily:'JetBrains Mono',
                    fontSize:13,fontWeight:600,color:'#fb7185' }}>
                    {fmt(t.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div style={{ padding:'12px 20px',borderTop:'1px solid #1e293b',
          display:'flex',alignItems:'center',justifyContent:'space-between' }}>
          <span style={{ fontSize:12,color:'#475569',fontFamily:'JetBrains Mono' }}>
            Page {page+1} of {pages} · {total} total
          </span>
          <div className="flex gap-2">
            <button onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0}
              style={{ padding:'4px 12px',borderRadius:6,fontSize:12,
                background:'#1e293b',border:'1px solid #334155',
                color:page===0?'#334155':'#94a3b8',cursor:page===0?'not-allowed':'pointer' }}>← Prev</button>
            <button onClick={()=>setPage(p=>Math.min(pages-1,p+1))} disabled={page>=pages-1}
              style={{ padding:'4px 12px',borderRadius:6,fontSize:12,
                background:'#1e293b',border:'1px solid #334155',
                color:page>=pages-1?'#334155':'#94a3b8',cursor:page>=pages-1?'not-allowed':'pointer' }}>Next →</button>
          </div>
        </div>
      )}
    </div>
  );
}
