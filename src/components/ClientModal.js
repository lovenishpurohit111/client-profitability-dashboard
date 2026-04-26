import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import API from '../config';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
const fmtC = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0, notation: 'compact' }).format(n);

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 10, padding: '10px 14px', fontFamily: 'DM Sans' }}>
      <p style={{ color: '#64748b', fontSize: 11, fontFamily: 'JetBrains Mono', marginBottom: 6 }}>{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex justify-between gap-4">
          <span style={{ color: p.color, fontSize: 12 }}>{p.name}</span>
          <span style={{ color: p.color, fontSize: 12, fontFamily: 'JetBrains Mono', fontWeight: 700 }}>{fmtC(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

const PAGE_SIZE = 8;

export default function ClientModal({ client, onClose }) {
  const [txns,    setTxns]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [page,    setPage]    = useState(0);
  const [search,  setSearch]  = useState('');
  const [typeFilter, setTypeFilter] = useState('All');

  const fetchTxns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/client-transactions`, { params: { client: client.client } });
      setTxns(res.data.transactions);
    } catch { setTxns([]); }
    finally { setLoading(false); }
  }, [client.client]);

  useEffect(() => { fetchTxns(); }, [fetchTxns]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const filtered = (txns || []).filter(t => {
    const matchSearch = !search || t.description.toLowerCase().includes(search.toLowerCase()) ||
      t.category.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'All' || t.type === typeFilter;
    return matchSearch && matchType;
  });
  const pages = Math.ceil(filtered.length / PAGE_SIZE);
  const visibleTxns = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const hs = client.health;

  return (
    <div
      className="modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-card">
        {/* Header */}
        <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid #1e293b' }}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div style={{
                width: 52, height: 52, borderRadius: 14, flexShrink: 0,
                background: `hsl(${client.client.charCodeAt(0) * 37 % 360},40%,15%)`,
                border: `2px solid hsl(${client.client.charCodeAt(0) * 37 % 360},40%,28%)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, fontWeight: 700,
                color: `hsl(${client.client.charCodeAt(0) * 37 % 360},65%,65%)`
              }}>
                {client.client.charAt(0)}
              </div>
              <div>
                <h2 className="text-white text-xl font-semibold" style={{ fontFamily: 'DM Serif Display' }}>{client.client}</h2>
                <div className="flex items-center gap-3 mt-1">
                  <span style={{
                    padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                    background: `${hs.color}18`, border: `1px solid ${hs.color}40`, color: hs.color,
                    fontFamily: 'JetBrains Mono'
                  }}>{hs.grade} · {hs.label}</span>
                  <span className="text-xs font-mono text-slate-500">
                    {client.invoice_status === 'active' ? '● Active' :
                     client.invoice_status === 'warning' ? '⚠ Warning' :
                     client.invoice_status === 'overdue' ? '🔴 Overdue' : '○ Inactive'}
                  </span>
                </div>
              </div>
            </div>
            <button onClick={onClose} style={{
              width: 32, height: 32, borderRadius: 8, border: '1px solid #334155',
              background: '#1e293b', color: '#94a3b8', cursor: 'pointer', fontSize: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>✕</button>
          </div>

          {/* KPI strip */}
          <div className="grid grid-cols-4 gap-3 mt-5">
            {[
              { label: 'Revenue',  value: fmt(client.revenue),  color: '#34d399' },
              { label: 'Expenses', value: fmt(client.expenses), color: '#fb7185' },
              { label: 'Profit',   value: fmt(client.profit),   color: client.profit >= 0 ? '#34d399' : '#fb7185' },
              { label: 'Margin',   value: `${client.margin.toFixed(1)}%`, color: client.margin >= 30 ? '#22d3ee' : client.margin >= 15 ? '#fbbf24' : '#fb7185' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: '10px 14px' }}>
                <p className="text-slate-500 text-xs font-mono mb-1">{label}</p>
                <p style={{ color, fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 14 }}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly chart */}
        <div style={{ padding: '20px 28px', borderBottom: '1px solid #1e293b' }}>
          <p className="text-slate-400 text-xs font-mono uppercase tracking-wider mb-3">Monthly Breakdown</p>
          {client.monthly_breakdown && client.monthly_breakdown.length > 1 ? (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={client.monthly_breakdown} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmtC} tick={{ fill: '#64748b', fontSize: 9, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTip />} />
                <Line type="monotone" dataKey="revenue"  name="Revenue"  stroke="#34d399" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="expenses" name="Expenses" stroke="#fb7185" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="profit"   name="Profit"   stroke="#22d3ee" strokeWidth={2} strokeDasharray="5 3" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-slate-600 text-sm text-center py-8">Not enough monthly data to chart</div>
          )}
        </div>

        {/* Transaction history */}
        <div style={{ padding: '20px 28px 28px' }}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-slate-400 text-xs font-mono uppercase tracking-wider">Transaction History</p>
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Search…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(0); }}
                style={{ padding: '5px 10px', borderRadius: 8, fontSize: 12, color: '#cbd5e1',
                  background: '#0f172a', border: '1px solid #334155', outline: 'none', width: 130 }}
              />
              <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(0); }}
                style={{ padding: '5px 10px', borderRadius: 8, fontSize: 12, color: '#cbd5e1',
                  background: '#0f172a', border: '1px solid #334155', outline: 'none' }}>
                <option value="All">All</option>
                <option value="Revenue">Revenue</option>
                <option value="Expense">Expense</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8 text-slate-500 text-sm">Loading transactions…</div>
          ) : (
            <>
              <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #1e293b' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#0f172a' }}>
                      {['Date', 'Description', 'Category', 'Type', 'Amount'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Amount' ? 'right' : 'left',
                          fontSize: 10, fontFamily: 'JetBrains Mono', color: '#475569',
                          textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid #1e293b' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleTxns.length === 0 ? (
                      <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: '#475569', fontSize: 13 }}>No transactions match</td></tr>
                    ) : visibleTxns.map((t, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(30,41,59,0.5)',
                        background: i % 2 === 0 ? 'transparent' : 'rgba(15,23,42,0.4)' }}>
                        <td style={{ padding: '10px 14px', fontFamily: 'JetBrains Mono', fontSize: 12, color: '#64748b' }}>{t.date}</td>
                        <td style={{ padding: '10px 14px', fontSize: 13, color: '#cbd5e1', maxWidth: 200 }}>{t.description || '—'}</td>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: '#64748b' }}>{t.category}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
                            background: t.type === 'Revenue' ? 'rgba(52,211,153,0.12)' : 'rgba(251,113,133,0.12)',
                            color: t.type === 'Revenue' ? '#34d399' : '#fb7185',
                            border: `1px solid ${t.type === 'Revenue' ? 'rgba(52,211,153,0.3)' : 'rgba(251,113,133,0.3)'}` }}>
                            {t.type}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'JetBrains Mono',
                          fontSize: 13, fontWeight: 600,
                          color: t.type === 'Revenue' ? '#34d399' : '#fb7185' }}>
                          {t.type === 'Revenue' ? '+' : '-'}{fmt(t.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {pages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p style={{ fontSize: 12, color: '#475569', fontFamily: 'JetBrains Mono' }}>
                    {filtered.length} transactions · page {page + 1}/{pages}
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                      style={{ padding: '4px 12px', borderRadius: 6, fontSize: 12, cursor: page === 0 ? 'not-allowed' : 'pointer',
                        background: '#1e293b', border: '1px solid #334155', color: page === 0 ? '#334155' : '#94a3b8' }}>
                      ← Prev
                    </button>
                    <button onClick={() => setPage(p => Math.min(pages - 1, p + 1))} disabled={page === pages - 1}
                      style={{ padding: '4px 12px', borderRadius: 6, fontSize: 12, cursor: page === pages-1 ? 'not-allowed' : 'pointer',
                        background: '#1e293b', border: '1px solid #334155', color: page === pages-1 ? '#334155' : '#94a3b8' }}>
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
