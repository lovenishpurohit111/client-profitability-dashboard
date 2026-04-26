import React, { useState } from 'react';
import axios from 'axios';
import API from '../config';

const CONF_COLOR = { high: '#34d399', medium: '#fbbf24', low: '#64748b' };
const CONF_LABEL = { high: 'High', medium: 'Medium', low: 'Low' };

function SummaryPill({ value, label, color, bg, border }) {
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12,
      padding: '12px 20px', textAlign: 'center', flex: 1 }}>
      <div style={{ fontSize: 28, fontFamily: 'JetBrains Mono', fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'DM Sans', marginTop: 4 }}>{label}</div>
    </div>
  );
}

export default function CategoryAudit({ clients }) {
  const [results,   setResults]   = useState(null);
  const [summary,   setSummary]   = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const [filter,    setFilter]    = useState('all');      // all | mismatch | uncertain
  const [search,    setSearch]    = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [clientFilter, setClientFilter] = useState('All');

  const run = async () => {
    setLoading(true); setError(null); setResults(null); setSummary(null);
    try {
      const res = await axios.post(`${API}/categorize`, {
        client: clientFilter !== 'All' ? clientFilter : undefined,
      });
      setResults(res.data.results);
      setSummary(res.data.summary);
    } catch (e) {
      setError(e.response?.data?.detail || 'Audit failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const clientList = ['All', ...(clients || [])];

  const visible = (results || []).filter(r => {
    if (filter === 'mismatch'  && r.match)              return false;
    if (filter === 'uncertain' && r.confidence !== 'low') return false;
    if (search && !r.description.toLowerCase().includes(search.toLowerCase()) &&
        !r.assigned_category.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="glass-card animate-slide-up"
      style={{ border: '1px solid rgba(56,189,248,0.2)' }}>

      {/* Header */}
      <div className="flex items-center justify-between p-6"
        style={{ borderBottom: results || loading ? '1px solid rgba(30,41,59,0.8)' : 'none',
          cursor: results ? 'pointer' : 'default' }}
        onClick={() => results && setCollapsed(c => !c)}>
        <div className="flex items-center gap-3">
          <div style={{ width: 40, height: 40, borderRadius: 10,
            background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
            🔍
          </div>
          <div>
            <h3 className="text-white font-semibold"
              style={{ fontFamily: 'DM Serif Display', fontSize: '1rem' }}>
              Category Accuracy Audit
            </h3>
            <p className="text-slate-500 text-xs font-mono mt-0.5">
              {summary
                ? `${summary.total} unique transactions audited via ${summary.source === 'claude+web' ? 'Claude + web search' : 'smart rule engine'}`
                : 'Verify transaction categories against web intelligence'}
            </p>
          </div>
          {summary && (
            <div className="flex items-center gap-2 ml-2">
              {summary.mismatch > 0 && (
                <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                  background: 'rgba(251,113,133,0.12)', color: '#fb7185',
                  border: '1px solid rgba(251,113,133,0.3)' }}>
                  {summary.mismatch} mismatch{summary.mismatch !== 1 ? 'es' : ''}
                </span>
              )}
              {summary.match > 0 && (
                <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                  background: 'rgba(52,211,153,0.1)', color: '#34d399',
                  border: '1px solid rgba(52,211,153,0.25)' }}>
                  {summary.match} correct
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Client filter */}
          {!results && (
            <select value={clientFilter} onChange={e => setClientFilter(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 8, fontSize: 12, color: '#cbd5e1',
                background: '#0f172a', border: '1px solid #334155', outline: 'none' }}
              onClick={e => e.stopPropagation()}>
              {clientList.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}

          <button
            onClick={(e) => { e.stopPropagation(); run(); }}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
              background: loading ? 'rgba(56,189,248,0.06)' : 'rgba(56,189,248,0.12)',
              border: '1px solid rgba(56,189,248,0.35)',
              color: '#38bdf8', cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1, transition: 'all 0.2s', whiteSpace: 'nowrap',
            }}>
            {loading ? (
              <>
                <div style={{ width: 12, height: 12, borderRadius: '50%',
                  border: '2px solid rgba(56,189,248,0.3)', borderTop: '2px solid #38bdf8',
                  animation: 'spin 0.8s linear infinite' }} />
                Auditing…
              </>
            ) : (
              <>🔍 {results ? 'Re-run Audit' : 'Run Audit'}</>
            )}
          </button>

          {results && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              style={{ color: '#475569', transform: collapsed ? 'rotate(0)' : 'rotate(180deg)',
                transition: 'transform 0.2s', flexShrink: 0 }}>
              <polyline points="6 9 12 15 18 9" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="p-6 space-y-3">
          <div className="flex items-center gap-3 mb-4">
            <div style={{ width: 14, height: 14, borderRadius: '50%',
              border: '2px solid rgba(56,189,248,0.2)', borderTop: '2px solid #38bdf8',
              animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
            <span className="text-slate-400 text-sm">
              Checking transaction descriptions against web knowledge…
            </span>
          </div>
          {[90, 70, 80, 60].map((w, i) => (
            <div key={i} style={{ height: 10, borderRadius: 5, width: `${w}%`,
              background: 'linear-gradient(90deg,#1e293b,#334155,#1e293b)',
              backgroundSize: '200% 100%', animation: `shimmer 1.5s ${i * 0.2}s infinite` }} />
          ))}
        </div>
      )}

      {error && !loading && (
        <div className="p-6 text-sm text-rose-400">{error}</div>
      )}

      {/* Results */}
      {results && !loading && !collapsed && (
        <div>
          {/* Summary pills */}
          <div className="flex gap-3 p-6 pb-0">
            <SummaryPill value={summary.total}     label="Audited"   color="#94a3b8" bg="rgba(30,41,59,0.4)"         border="#334155" />
            <SummaryPill value={summary.match}     label="Correct"   color="#34d399" bg="rgba(52,211,153,0.06)"      border="rgba(52,211,153,0.2)" />
            <SummaryPill value={summary.mismatch}  label="Mismatch"  color="#fb7185" bg="rgba(251,113,133,0.06)"     border="rgba(251,113,133,0.2)" />
            <SummaryPill value={summary.uncertain} label="Uncertain" color="#fbbf24" bg="rgba(251,191,36,0.06)"      border="rgba(251,191,36,0.2)" />
          </div>

          {/* Filter + search bar */}
          <div className="flex items-center gap-3 p-6 pb-3 flex-wrap">
            {['all','mismatch','uncertain'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                style={{
                  padding: '5px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                  cursor: 'pointer', transition: 'all 0.15s',
                  background: filter === f ? 'rgba(56,189,248,0.15)' : 'rgba(30,41,59,0.4)',
                  border: `1px solid ${filter === f ? 'rgba(56,189,248,0.4)' : '#334155'}`,
                  color: filter === f ? '#38bdf8' : '#64748b',
                }}>
                {f === 'all' ? 'All' : f === 'mismatch' ? '✗ Mismatches' : '? Uncertain'}
              </button>
            ))}
            <div style={{ position: 'relative', marginLeft: 'auto' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)',
                  color: '#475569', pointerEvents: 'none' }}>
                <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
                <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <input type="text" placeholder="Search descriptions…" value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ padding: '6px 10px 6px 28px', borderRadius: 8, fontSize: 12,
                  background: '#0f172a', border: '1px solid #334155', color: '#cbd5e1',
                  outline: 'none', width: 200 }} />
            </div>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto', padding: '0 0 24px 0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Description', 'Assigned Category', 'Assigned Type',
                    'Suggested Category', 'Suggested Type', 'Match', 'Confidence', 'Reason'].map(h => (
                    <th key={h} style={{
                      padding: '10px 16px', textAlign: 'left', fontSize: 10,
                      fontFamily: 'JetBrains Mono', color: '#475569',
                      textTransform: 'uppercase', letterSpacing: '0.08em',
                      borderBottom: '1px solid #1e293b', whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: 32,
                      color: '#475569', fontSize: 13 }}>
                      No transactions match the current filter.
                    </td>
                  </tr>
                ) : visible.map((r, i) => {
                  const rowBg = !r.match
                    ? 'rgba(251,113,133,0.04)'
                    : r.confidence === 'low'
                    ? 'rgba(251,191,36,0.03)'
                    : 'transparent';
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(30,41,59,0.5)',
                      background: i % 2 === 0 ? rowBg : 'rgba(15,23,42,0.3)' }}>

                      {/* Description */}
                      <td style={{ padding: '11px 16px', fontSize: 13, color: '#e2e8f0',
                        maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.description}
                      </td>

                      {/* Assigned category */}
                      <td style={{ padding: '11px 16px', fontSize: 12, color: '#94a3b8' }}>
                        {r.assigned_category}
                      </td>

                      {/* Assigned type */}
                      <td style={{ padding: '11px 16px' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px',
                          borderRadius: 6,
                          background: r.assigned_type === 'Revenue' ? 'rgba(52,211,153,0.1)' : 'rgba(251,113,133,0.1)',
                          color: r.assigned_type === 'Revenue' ? '#34d399' : '#fb7185',
                          border: `1px solid ${r.assigned_type === 'Revenue' ? 'rgba(52,211,153,0.25)' : 'rgba(251,113,133,0.25)'}` }}>
                          {r.assigned_type}
                        </span>
                      </td>

                      {/* Suggested category */}
                      <td style={{ padding: '11px 16px', fontSize: 12,
                        color: r.match ? '#64748b' : '#fbbf24', fontWeight: r.match ? 400 : 600 }}>
                        {r.suggested_category}
                      </td>

                      {/* Suggested type */}
                      <td style={{ padding: '11px 16px' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px',
                          borderRadius: 6,
                          background: r.suggested_type === 'Revenue' ? 'rgba(52,211,153,0.1)' : 'rgba(251,113,133,0.1)',
                          color: r.suggested_type === 'Revenue' ? '#34d399' : '#fb7185',
                          border: `1px solid ${r.suggested_type === 'Revenue' ? 'rgba(52,211,153,0.25)' : 'rgba(251,113,133,0.25)'}` }}>
                          {r.suggested_type || r.assigned_type}
                        </span>
                      </td>

                      {/* Match badge */}
                      <td style={{ padding: '11px 16px' }}>
                        {r.confidence === 'low' ? (
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px',
                            borderRadius: 6, background: 'rgba(251,191,36,0.1)',
                            color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)' }}>
                            ? Unknown
                          </span>
                        ) : r.match ? (
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px',
                            borderRadius: 6, background: 'rgba(52,211,153,0.1)',
                            color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }}>
                            ✓ Match
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px',
                            borderRadius: 6, background: 'rgba(251,113,133,0.1)',
                            color: '#fb7185', border: '1px solid rgba(251,113,133,0.25)' }}>
                            ✗ Mismatch
                          </span>
                        )}
                      </td>

                      {/* Confidence */}
                      <td style={{ padding: '11px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%',
                            background: CONF_COLOR[r.confidence] || '#64748b' }} />
                          <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono',
                            color: CONF_COLOR[r.confidence] || '#64748b' }}>
                            {CONF_LABEL[r.confidence] || r.confidence}
                          </span>
                        </div>
                      </td>

                      {/* Reason */}
                      <td style={{ padding: '11px 16px', fontSize: 11, color: '#64748b',
                        maxWidth: 260, lineHeight: 1.4 }}>
                        {r.reason}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer note */}
          <div style={{ padding: '0 24px 20px', borderTop: '1px solid rgba(30,41,59,0.5)' }}>
            <p className="text-xs text-slate-600 pt-4">
              💡 <span className="text-slate-500">
                {summary.source === 'claude+web'
                  ? 'Categories verified using Claude AI + real-time web search. Review mismatches and update your source data for cleaner reporting.'
                  : 'Categories verified using smart keyword matching. Set ANTHROPIC_API_KEY for Claude AI + live web search accuracy.'}
              </span>
            </p>
          </div>
        </div>
      )}

      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes spin { to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}
