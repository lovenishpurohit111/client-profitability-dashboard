import React, { useState, useMemo } from 'react';
import SummaryCards from './SummaryCards';
import VendorTable from './VendorTable';
import CategoryBreakdown from './CategoryBreakdown';
import SpendTrend from './SpendTrend';
import TransactionLog from './TransactionLog';
import ReconcilePanel from './ReconcilePanel';

function applyFilters(data, vendor, startDate, endDate) {
  let txns       = data.transactions || [];
  let vendors    = data.vendors      || [];
  let categories = data.categories   || [];
  let trend      = data.trend        || [];

  if (vendor) {
    txns = txns.filter(t => t.vendor === vendor);
  }
  if (startDate) {
    txns = txns.filter(t => t.date >= startDate);
  }
  if (endDate) {
    txns = txns.filter(t => t.date <= endDate);
  }

  // Recompute vendors / categories / trend from filtered txns
  if (vendor || startDate || endDate) {
    const vendorMap = {}, catMap = {}, monthMap = {};
    let total = 0;
    for (const t of txns) {
      total += t.amount;
      if (!vendorMap[t.vendor]) vendorMap[t.vendor] = { spend:0, txns:[], top_cat:{}, last_date:'1900-01-01' };
      vendorMap[t.vendor].spend += t.amount;
      vendorMap[t.vendor].txns.push(t);
      vendorMap[t.vendor].top_cat[t.category] = (vendorMap[t.vendor].top_cat[t.category]||0) + t.amount;
      if (t.date > vendorMap[t.vendor].last_date) vendorMap[t.vendor].last_date = t.date;
      catMap[t.category] = (catMap[t.category]||{sum:0,count:0});
      catMap[t.category].sum += t.amount; catMap[t.category].count++;
      monthMap[t.date.slice(0,7)] = (monthMap[t.date.slice(0,7)]||{spend:0,transactions:0});
      monthMap[t.date.slice(0,7)].spend += t.amount;
      monthMap[t.date.slice(0,7)].transactions++;
    }
    vendors = Object.entries(vendorMap).map(([v,d]) => ({
      vendor: v, spend: Math.round(d.spend*100)/100,
      pct_of_total: total > 0 ? Math.round(d.spend/total*1000)/10 : 0,
      txn_count: d.txns.length,
      avg_txn: Math.round(d.spend/d.txns.length*100)/100,
      top_category: Object.entries(d.top_cat).sort((a,b)=>b[1]-a[1])[0]?.[0] || '',
      last_date: d.last_date,
    })).sort((a,b) => b.spend - a.spend);
    categories = Object.entries(catMap).map(([c,d]) => ({
      category: c, amount: Math.round(d.sum*100)/100, count: d.count,
      pct: total > 0 ? Math.round(d.sum/total*1000)/10 : 0,
    })).sort((a,b) => b.amount - a.amount);
    trend = Object.entries(monthMap).map(([m,d]) => ({
      month: m, spend: Math.round(d.spend*100)/100, transactions: d.transactions,
    })).sort((a,b) => a.month.localeCompare(b.month));
  }

  const total = txns.reduce((s,t)=>s+t.amount,0);
  const topVendor = vendors[0]?.vendor || null;
  const topCategory = categories[0]?.category || null;
  const months = new Set(txns.map(t=>t.date.slice(0,7))).size;
  const summary = {
    total_spend: Math.round(total*100)/100,
    vendor_count: vendors.length,
    transaction_count: txns.length,
    avg_transaction: txns.length ? Math.round(total/txns.length*100)/100 : 0,
    top_vendor: topVendor,
    top_category: topCategory,
    monthly_avg: Math.round(total/Math.max(months,1)*100)/100,
    categories: categories.length,
  };

  return { summary, vendors, categories, trend, txns };
}

export default function Dashboard({ data, onReset }) {
  const [vendor,    setVendor]    = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate,   setEndDate]   = useState('');

  const filtered = useMemo(
    () => applyFilters(data, vendor, startDate, endDate),
    [data, vendor, startDate, endDate]
  );

  const fmtC = n => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',
    maximumFractionDigits:0,notation:'compact'}).format(n);

  return (
    <div className="min-h-screen px-4 py-6 max-w-7xl mx-auto">

      {/* Top bar */}
      <div className="flex items-center justify-between mb-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <div style={{ width:42,height:42,borderRadius:11,
            background:'linear-gradient(135deg,#38bdf8,#818cf8)',
            display:'flex',alignItems:'center',justifyContent:'center',fontSize:20 }}>🔍</div>
          <div>
            <div className="text-white font-semibold text-lg" style={{ fontFamily:'DM Serif Display' }}>
              VendorLens
            </div>
            <div className="text-slate-500 text-xs font-mono">
              {data.rows} transactions · {data.vendors} vendors
              {data.file_format === 'quickbooks-vendor' &&
                <span style={{ color:'#38bdf8' }}> · QuickBooks ✓</span>}
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
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-sm text-slate-300"
              style={{ background:'#0f172a',border:'1px solid #334155',outline:'none' }}/>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-slate-500 text-xs">To</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-sm text-slate-300"
              style={{ background:'#0f172a',border:'1px solid #334155',outline:'none' }}/>
          </div>
          {vendor && (
            <div style={{ display:'flex',alignItems:'center',gap:8,padding:'4px 12px',
              borderRadius:8,background:'rgba(56,189,248,0.1)',border:'1px solid rgba(56,189,248,0.3)' }}>
              <span style={{ fontSize:12,color:'#38bdf8' }}>📌 {vendor}</span>
              <button onClick={() => setVendor(null)}
                style={{ background:'none',border:'none',color:'#38bdf8',cursor:'pointer',fontSize:14 }}>✕</button>
            </div>
          )}
          <button onClick={() => { setVendor(null); setStartDate(''); setEndDate(''); }}
            className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white transition-colors"
            style={{ background:'rgba(51,65,85,0.4)',border:'1px solid #334155' }}>
            Reset
          </button>
          <span className="text-slate-600 text-xs font-mono ml-auto">
            {filtered.txns.length} of {data.rows} transactions · {fmtC(filtered.summary.total_spend)}
          </span>
        </div>
      </div>

      <div className="space-y-6">
        {/* KPIs */}
        <SummaryCards summary={filtered.summary} />

        {/* Top spend highlight */}
        {filtered.summary.top_vendor && (
          <div style={{ background:'rgba(251,113,133,0.06)',border:'1px solid rgba(251,113,133,0.2)',
            borderRadius:14,padding:'14px 20px',display:'flex',alignItems:'center',gap:16 }}>
            <span style={{ fontSize:20 }}>🏆</span>
            <p className="text-white font-semibold" style={{ fontSize:14 }}>
              <span style={{ color:'#fb7185' }}>{filtered.summary.top_vendor}</span>
              {' '}is your highest-spend vendor ·{' '}
              <span style={{ color:'#fbbf24' }}>{filtered.summary.top_category}</span>
              {' '}is the biggest expense category
            </p>
          </div>
        )}

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CategoryBreakdown categories={filtered.categories} />
          <SpendTrend trend={filtered.trend} />
        </div>

        {/* Reconciliation — passes combos directly, no server state needed */}
        <ReconcilePanel
          combos={data.combos || []}
          vendors={data.vendor_list || []}
          activeVendor={vendor}
        />

        {/* Vendor table */}
        <VendorTable
          vendors={filtered.vendors}
          onSelectVendor={v => setVendor(v === vendor ? null : v)}
          selectedVendor={vendor}
        />

        {/* Transaction log — pure client-side filtering */}
        <TransactionLog
          transactions={filtered.txns}
          categories={data.category_list || []}
        />
      </div>
    </div>
  );
}
