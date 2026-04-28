import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import API from '../config';
import SummaryCards from './SummaryCards';
import VendorTable from './VendorTable';
import CategoryBreakdown from './CategoryBreakdown';
import SpendTrend from './SpendTrend';
import TransactionLog from './TransactionLog';
import ReconcilePanel from './ReconcilePanel';

export default function Dashboard({ meta, onReset }) {
  const [summary,    setSummary]    = useState(null);
  const [vendors,    setVendors]    = useState([]);
  const [categories, setCategories] = useState([]);
  const [trend,      setTrend]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [vendor,     setVendor]     = useState(null);
  const [startDate,  setStartDate]  = useState('');
  const [endDate,    setEndDate]    = useState('');

  const fmt = (n) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0,notation:'compact'}).format(n);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = {};
    if (startDate) params.start_date = startDate;
    if (endDate)   params.end_date   = endDate;
    if (vendor)    params.vendor     = vendor;
    try {
      const [sumRes, vendRes, catRes, trendRes] = await Promise.allSettled([
        axios.get(`${API}/summary`,    { params }),
        axios.get(`${API}/vendors`,    { params }),
        axios.get(`${API}/categories`, { params }),
        axios.get(`${API}/trend`,      { params: vendor ? { vendor } : {} }),
      ]);
      if (sumRes.status  === 'fulfilled') setSummary(sumRes.value.data);
      if (vendRes.status === 'fulfilled') setVendors(vendRes.value.data.vendors || []);
      if (catRes.status  === 'fulfilled') setCategories(catRes.value.data.categories || []);
      if (trendRes.status=== 'fulfilled') setTrend(trendRes.value.data.trend || []);

      // Surface first error if all failed
      const firstErr = [sumRes, vendRes, catRes, trendRes].find(r => r.status === 'rejected');
      if (firstErr && !sumRes.value && !vendRes.value) {
        setError(firstErr.reason?.response?.data?.detail || 'Failed to load data.');
      }
    } catch (e) {
      setError('Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [vendor, startDate, endDate]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleSelectVendor = (v) => setVendor(v);
  const resetFilters = () => {
    setVendor(null);
    setStartDate('');
    setEndDate('');
  };

  return (
    <div className="min-h-screen px-4 py-6 max-w-7xl mx-auto">

      {/* Top bar */}
      <div className="flex items-center justify-between mb-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <div style={{ width:42,height:42,borderRadius:11,background:'linear-gradient(135deg,#38bdf8,#818cf8)',
            display:'flex',alignItems:'center',justifyContent:'center',fontSize:20 }}>🔍</div>
          <div>
            <div className="text-white font-semibold text-lg" style={{ fontFamily:'DM Serif Display' }}>VendorLens</div>
            <div className="text-slate-500 text-xs font-mono">
              {meta?.rows} transactions · {meta?.vendors} vendors
              {meta?.file_format==='quickbooks-vendor' && <span style={{ color:'#38bdf8' }}> · QuickBooks ✓</span>}
            </div>
          </div>
        </div>
        <button onClick={onReset}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white transition-colors"
          style={{ background:'rgba(30,41,59,0.6)',border:'1px solid #334155' }}>
          ↑ New File
        </button>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 mb-6 animate-slide-up">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-slate-400 text-xs font-mono uppercase tracking-wider">Filters</span>
          <div className="flex items-center gap-2">
            <label className="text-slate-500 text-xs">From</label>
            <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-sm text-slate-300"
              style={{ background:'#0f172a',border:'1px solid #334155',outline:'none' }}/>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-slate-500 text-xs">To</label>
            <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-sm text-slate-300"
              style={{ background:'#0f172a',border:'1px solid #334155',outline:'none' }}/>
          </div>
          {vendor && (
            <div style={{ display:'flex',alignItems:'center',gap:8,padding:'4px 12px',borderRadius:8,
              background:'rgba(56,189,248,0.1)',border:'1px solid rgba(56,189,248,0.3)' }}>
              <span style={{ fontSize:12,color:'#38bdf8' }}>📌 {vendor}</span>
              <button onClick={()=>setVendor(null)}
                style={{ background:'none',border:'none',color:'#38bdf8',cursor:'pointer',fontSize:14,lineHeight:1 }}>✕</button>
            </div>
          )}
          <button onClick={resetFilters}
            className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white transition-colors"
            style={{ background:'rgba(51,65,85,0.4)',border:'1px solid #334155' }}>
            Reset
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div style={{ width:44,height:44,border:'3px solid #1e293b',borderTop:'3px solid #38bdf8',
            borderRadius:'50%',animation:'spin 0.8s linear infinite' }}/>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      ) : error ? (
        <div className="glass-card p-8 text-center">
          <p style={{ color:'#fb7185', fontSize:14, marginBottom:8 }}>⚠ {error}</p>
          <button onClick={fetchAll} style={{ padding:'8px 20px', borderRadius:8, fontSize:13,
            background:'rgba(56,189,248,0.1)', border:'1px solid rgba(56,189,248,0.3)',
            color:'#38bdf8', cursor:'pointer' }}>Retry</button>
        </div>
      ) : (
        <div className="space-y-6">

          {/* KPIs */}
          <SummaryCards summary={summary}/>

          {/* Top spend highlight */}
          {summary?.top_vendor && (
            <div style={{ background:'rgba(251,113,133,0.06)',border:'1px solid rgba(251,113,133,0.2)',
              borderRadius:14,padding:'14px 20px',display:'flex',alignItems:'center',gap:16 }}>
              <span style={{ fontSize:20 }}>🏆</span>
              <div>
                <span className="text-xs font-mono uppercase tracking-wider" style={{ color:'#fb7185' }}>Top Vendor</span>
                <p className="text-white font-semibold mt-0.5">
                  <span style={{ color:'#fb7185' }}>{summary.top_vendor}</span> is your highest-spend vendor ·{' '}
                  <span style={{ color:'#fbbf24' }}>{summary.top_category}</span> is the biggest expense category
                </p>
              </div>
            </div>
          )}

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CategoryBreakdown categories={categories}/>
            <SpendTrend trend={trend}/>
          </div>

          {/* Reconciliation — centerpiece */}
          <ReconcilePanel vendor={vendor} vendors={meta?.vendor_list || []}/>

          {/* Vendor table */}
          <VendorTable vendors={vendors} onSelectVendor={handleSelectVendor} selectedVendor={vendor}/>

          {/* Transaction log */}
          <TransactionLog vendor={vendor} categories={meta?.category_list || []}/>

        </div>
      )}
    </div>
  );
}
