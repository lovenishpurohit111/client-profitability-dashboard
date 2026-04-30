import React, { useState } from 'react';
import axios from 'axios';
import API from '../config';

const CONF_COLOR = { high:'#34d399', medium:'#fbbf24', low:'#64748b' };

export default function ReconcilePanel({ vendor, vendors, sessionId }) {
  const [results,   setResults]   = useState(null);
  const [summary,   setSummary]   = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const [filter,    setFilter]    = useState('all');
  const [search,    setSearch]    = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(vendor || 'All');

  const run = async () => {
    setLoading(true); setError(null); setResults(null); setSummary(null);
    try {
      const res = await axios.post(`${API}/reconcile`, {
        vendor: selectedVendor !== 'All' ? selectedVendor : undefined,
        session_id: sessionId || '',
      });
      setResults(res.data.results);
      setSummary(res.data.summary);
      setCollapsed(false);
    } catch (e) {
      setError(e.response?.data?.detail || 'Reconciliation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const vendorList = ['All', ...(vendors || [])];

  const visible = (results || []).filter(r => {
    if (filter === 'mismatch'  && r.match)                return false;
    if (filter === 'uncertain' && r.confidence !== 'low') return false;
    if (search && !r.vendor.toLowerCase().includes(search.toLowerCase()) &&
        !r.memo.toLowerCase().includes(search.toLowerCase()) &&
        !r.assigned_category.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const accuracy = summary?.accuracy;
  const accColor = accuracy >= 85 ? '#34d399' : accuracy >= 65 ? '#fbbf24' : '#fb7185';

  return (
    <div className="glass-card" style={{ border:'1px solid rgba(56,189,248,0.2)' }}>
      {/* Header */}
      <div style={{ padding:'20px 24px', borderBottom: (results || loading) ? '1px solid rgba(30,41,59,0.8)' : 'none',
        cursor: results ? 'pointer' : 'default' }}
        onClick={() => results && setCollapsed(c => !c)}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div style={{ width:42,height:42,borderRadius:11,background:'rgba(56,189,248,0.1)',
              border:'1px solid rgba(56,189,248,0.3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20 }}>
              🔍
            </div>
            <div>
              <h3 className="text-white font-semibold" style={{ fontFamily:'DM Serif Display',fontSize:'1.1rem' }}>
                Category Reconciliation
              </h3>
              <p className="text-slate-500 text-xs font-mono mt-0.5">
                {summary
                  ? `${summary.total} transactions · ${summary.source === 'claude+web' ? 'Claude AI + web search' : 'DuckDuckGo + smart rules'}`
                  : 'Verify each transaction\'s Split category against its vendor + memo via web search'}
              </p>
            </div>

            {/* Accuracy badge */}
            {summary && (
              <div style={{ marginLeft:8, padding:'6px 16px', borderRadius:12,
                background:`${accColor}12`, border:`1px solid ${accColor}30`,
                textAlign:'center' }}>
                <div style={{ fontFamily:'JetBrains Mono',fontWeight:700,fontSize:20,color:accColor,lineHeight:1 }}>
                  {accuracy}%
                </div>
                <div style={{ fontSize:10,color:'#64748b',marginTop:2 }}>accuracy</div>
              </div>
            )}

            {/* Pill counts */}
            {summary && (
              <div className="flex gap-2 flex-wrap">
                {summary.match > 0 && (
                  <span style={{ padding:'2px 10px',borderRadius:20,fontSize:11,fontWeight:700,
                    background:'rgba(52,211,153,0.1)',color:'#34d399',border:'1px solid rgba(52,211,153,0.25)' }}>
                    ✓ {summary.match} correct
                  </span>
                )}
                {summary.mismatch > 0 && (
                  <span style={{ padding:'2px 10px',borderRadius:20,fontSize:11,fontWeight:700,
                    background:'rgba(251,113,133,0.1)',color:'#fb7185',border:'1px solid rgba(251,113,133,0.25)' }}>
                    ✗ {summary.mismatch} mismatch{summary.mismatch!==1?'es':''}
                  </span>
                )}
                {summary.uncertain > 0 && (
                  <span style={{ padding:'2px 10px',borderRadius:20,fontSize:11,fontWeight:700,
                    background:'rgba(251,191,36,0.1)',color:'#fbbf24',border:'1px solid rgba(251,191,36,0.25)' }}>
                    ? {summary.uncertain} uncertain
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3" onClick={e=>e.stopPropagation()}>
            <select value={selectedVendor} onChange={e=>setSelectedVendor(e.target.value)}
              style={{ padding:'7px 10px',borderRadius:8,fontSize:12,color:'#cbd5e1',
                background:'#0f172a',border:'1px solid #334155',outline:'none' }}>
              {vendorList.map(v=><option key={v} value={v}>{v}</option>)}
            </select>
            <button onClick={run} disabled={loading}
              style={{ display:'flex',alignItems:'center',gap:8,padding:'9px 20px',
                borderRadius:10,fontSize:13,fontWeight:600,whiteSpace:'nowrap',
                background:loading?'rgba(56,189,248,0.06)':'rgba(56,189,248,0.14)',
                border:'1px solid rgba(56,189,248,0.4)',
                color:'#38bdf8',cursor:loading?'not-allowed':'pointer',
                opacity:loading?0.7:1,transition:'all 0.2s' }}>
              {loading ? (
                <><div style={{ width:12,height:12,borderRadius:'50%',
                  border:'2px solid rgba(56,189,248,0.2)',borderTop:'2px solid #38bdf8',
                  animation:'spin 0.8s linear infinite' }}/>Reconciling…</>
              ) : <>🔍 {results?'Re-run':'Run Reconciliation'}</>}
            </button>
            {results && (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                style={{ color:'#475569',transform:collapsed?'rotate(0)':'rotate(180deg)',transition:'transform 0.2s',flexShrink:0,cursor:'pointer' }}
                onClick={()=>setCollapsed(c=>!c)}>
                <polyline points="6 9 12 15 18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ padding:'24px 24px' }}>
          <div className="flex items-center gap-3 mb-5">
            <div style={{ width:14,height:14,borderRadius:'50%',border:'2px solid rgba(56,189,248,0.2)',
              borderTop:'2px solid #38bdf8',animation:'spin 0.8s linear infinite',flexShrink:0 }}/>
            <span style={{ color:'#94a3b8',fontSize:14 }}>
              Looking up each transaction's vendor and memo via web search…
            </span>
          </div>
          {[95,75,85,65,80].map((w,i)=>(
            <div key={i} style={{ height:10,borderRadius:5,width:`${w}%`,marginBottom:8,
              background:'linear-gradient(90deg,#1e293b,#334155,#1e293b)',
              backgroundSize:'200% 100%',animation:`shimmer 1.5s ${i*0.15}s infinite` }}/>
          ))}
        </div>
      )}

      {error && !loading && (
        <div style={{ padding:'20px 24px',fontSize:13,color:'#fb7185' }}>{error}</div>
      )}

      {/* Results */}
      {results && !loading && !collapsed && (
        <div>
          {/* Filter bar */}
          <div style={{ padding:'16px 24px 12px',display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',
            borderBottom:'1px solid rgba(30,41,59,0.5)' }}>
            {['all','mismatch','uncertain'].map(f=>(
              <button key={f} onClick={()=>setFilter(f)}
                style={{ padding:'5px 14px',borderRadius:8,fontSize:12,fontWeight:500,cursor:'pointer',
                  background:filter===f?'rgba(56,189,248,0.15)':'rgba(30,41,59,0.4)',
                  border:`1px solid ${filter===f?'rgba(56,189,248,0.4)':'#334155'}`,
                  color:filter===f?'#38bdf8':'#64748b' }}>
                {f==='all'?`All (${results.length})`:f==='mismatch'?`✗ Mismatches (${summary?.mismatch||0})`:`? Uncertain (${summary?.uncertain||0})`}
              </button>
            ))}
            <div style={{ position:'relative',marginLeft:'auto' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                style={{ position:'absolute',left:8,top:'50%',transform:'translateY(-50%)',color:'#475569',pointerEvents:'none' }}>
                <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
                <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <input type="text" placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)}
                style={{ padding:'6px 10px 6px 26px',borderRadius:7,fontSize:12,
                  background:'#0f172a',border:'1px solid #334155',color:'#cbd5e1',outline:'none',width:180 }}/>
            </div>
          </div>

          {/* Results table */}
          <div className="overflow-x-auto">
            <table style={{ width:'100%',borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  {['Vendor','Memo','Assigned Category','Suggested Category','Match','Confidence','Reason'].map(h=>(
                    <th key={h} style={{ padding:'10px 16px',textAlign:'left',fontSize:10,
                      fontFamily:'JetBrains Mono',color:'#475569',textTransform:'uppercase',
                      letterSpacing:'0.08em',borderBottom:'1px solid #1e293b',whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign:'center',padding:28,color:'#475569',fontSize:13 }}>
                    No results match the current filter.
                  </td></tr>
                ) : visible.map((r,i)=>{
                  const rowBg = !r.match ? 'rgba(251,113,133,0.04)'
                    : r.confidence==='low' ? 'rgba(251,191,36,0.03)' : 'transparent';
                  return (
                    <tr key={i} style={{ borderBottom:'1px solid rgba(30,41,59,0.5)',
                      background:i%2===0?rowBg:'rgba(15,23,42,0.35)' }}>
                      <td style={{ padding:'11px 16px',fontSize:13,color:'#e2e8f0',fontWeight:500,whiteSpace:'nowrap' }}>
                        {r.vendor}
                      </td>
                      <td style={{ padding:'11px 16px',fontSize:12,color:'#94a3b8',maxWidth:220,
                        overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }} title={r.memo}>
                        {r.memo || '—'}
                      </td>
                      <td style={{ padding:'11px 16px' }}>
                        <span style={{ fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:6,
                          background:'rgba(196,181,253,0.1)',color:'#c4b5fd',border:'1px solid rgba(196,181,253,0.2)' }}>
                          {r.assigned_category}
                        </span>
                      </td>
                      <td style={{ padding:'11px 16px',fontSize:12,whiteSpace:'nowrap',
                        color:r.match?'#64748b':'#fbbf24',fontWeight:r.match?400:600 }}>
                        {r.suggested_category}
                      </td>
                      <td style={{ padding:'11px 16px' }}>
                        {r.confidence==='low' ? (
                          <span style={{ fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:6,
                            background:'rgba(251,191,36,0.1)',color:'#fbbf24',border:'1px solid rgba(251,191,36,0.25)' }}>
                            ? Unknown
                          </span>
                        ) : r.match ? (
                          <span style={{ fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:6,
                            background:'rgba(52,211,153,0.1)',color:'#34d399',border:'1px solid rgba(52,211,153,0.25)' }}>
                            ✓ Match
                          </span>
                        ) : (
                          <span style={{ fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:6,
                            background:'rgba(251,113,133,0.1)',color:'#fb7185',border:'1px solid rgba(251,113,133,0.25)' }}>
                            ✗ Mismatch
                          </span>
                        )}
                      </td>
                      <td style={{ padding:'11px 16px' }}>
                        <div style={{ display:'flex',alignItems:'center',gap:5 }}>
                          <div style={{ width:6,height:6,borderRadius:'50%',background:CONF_COLOR[r.confidence]||'#64748b' }}/>
                          <span style={{ fontSize:11,fontFamily:'JetBrains Mono',color:CONF_COLOR[r.confidence]||'#64748b',
                            textTransform:'capitalize' }}>{r.confidence}</span>
                        </div>
                      </td>
                      <td style={{ padding:'11px 16px',fontSize:11,color:'#64748b',maxWidth:280,lineHeight:1.4 }}>
                        {r.reason}
                        {r.source==='duckduckgo+rules' && (
                          <span style={{ marginLeft:6,fontSize:10,color:'#38bdf8' }}>· web</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div style={{ padding:'12px 24px 20px',borderTop:'1px solid rgba(30,41,59,0.5)' }}>
            <p style={{ fontSize:11,color:'#475569' }}>
              💡 {summary?.source==='claude+web'
                ? 'Verified using Claude AI + real-time web search. Set ANTHROPIC_API_KEY env var to enable.'
                : 'Verified using DuckDuckGo instant answers + keyword classification. For higher accuracy, set ANTHROPIC_API_KEY.'}
            </p>
          </div>
        </div>
      )}

      <style>{`
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
    </div>
  );
}
