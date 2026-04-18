import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import API from '../config';
import SummaryCards from './SummaryCards';
import ClientTable from './ClientTable';
import ProfitBarChart from './ProfitBarChart';
import ExpensePieChart from './ExpensePieChart';
import MonthlyLineChart from './MonthlyLineChart';
import InvoiceAlerts from './InvoiceAlerts';
import ExportButtons from './ExportButtons';

export default function Dashboard({ meta, onReset }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const dashboardRef          = useRef(null);

  const [startDate,       setStartDate]       = useState(meta?.date_range?.min || '');
  const [endDate,         setEndDate]         = useState(meta?.date_range?.max || '');
  const [selectedClient,  setSelectedClient]  = useState('All');

  const fetchDashboard = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = {};
      if (startDate)                    params.start_date = startDate;
      if (endDate)                      params.end_date   = endDate;
      if (selectedClient !== 'All')     params.client     = selectedClient;
      const res = await axios.get(`${API}/dashboard`, { params });
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedClient]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const clients = ['All', ...(meta?.clients_list || [])];

  return (
    <div className="min-h-screen px-4 py-6 max-w-7xl mx-auto">

      {/* Top Nav */}
      <div className="flex items-center justify-between mb-8 animate-fade-in">
        <div className="flex items-center gap-3">
          <div style={{ width:40,height:40,borderRadius:10,background:'linear-gradient(135deg,#34d399,#22d3ee)',display:'flex',alignItems:'center',justifyContent:'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <div className="text-white font-semibold text-lg" style={{ fontFamily:'DM Serif Display' }}>ProfitLens</div>
            <div className="text-slate-500 text-xs font-mono">{meta?.rows} rows · {meta?.clients} clients</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Export buttons */}
          {data && <ExportButtons dashboardRef={dashboardRef} clients={data.clients} />}

          <button onClick={onReset}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white transition-colors"
            style={{ background:'rgba(30,41,59,0.6)', border:'1px solid #334155' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="17 8 12 3 7 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            New File
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 mb-6 animate-slide-up">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-slate-400">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-slate-400 text-xs font-mono uppercase tracking-wider">Filters</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-slate-500 text-xs">From</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-sm text-slate-300 focus:outline-none"
              style={{ background:'#0f172a', border:'1px solid #334155' }} />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-slate-500 text-xs">To</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-sm text-slate-300 focus:outline-none"
              style={{ background:'#0f172a', border:'1px solid #334155' }} />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-slate-500 text-xs">Client</label>
            <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-sm text-slate-300 focus:outline-none"
              style={{ background:'#0f172a', border:'1px solid #334155' }}>
              {clients.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <button onClick={() => { setStartDate(meta?.date_range?.min||''); setEndDate(meta?.date_range?.max||''); setSelectedClient('All'); }}
            className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white transition-colors"
            style={{ background:'rgba(51,65,85,0.4)', border:'1px solid #334155' }}>
            Reset
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-4">
            <div style={{ width:48,height:48,border:'3px solid #1e293b',borderTop:'3px solid #34d399',borderRadius:'50%',animation:'spin 0.8s linear infinite' }} />
            <p className="text-slate-500 text-sm">Crunching numbers...</p>
          </div>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {error && !loading && (
        <div className="glass-card p-6 text-center text-rose-400"><p>{error}</p></div>
      )}

      {data && !loading && (
        <div ref={dashboardRef} className="space-y-6">

          {/* KPI Cards */}
          <SummaryCards summary={data.summary} />

          {/* Invoice Alerts — only shown when there are alerts */}
          <InvoiceAlerts alerts={data.invoice_alerts || []} />

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass-card p-6 animate-slide-up stagger-2">
              <ChartHeader title="Profit per Client" subtitle="Revenue minus expenses" icon="📊" />
              <ProfitBarChart clients={data.clients} />
            </div>
            <div className="glass-card p-6 animate-slide-up stagger-3">
              <ChartHeader title="Expense Breakdown" subtitle="By category" icon="🥧" />
              <ExpensePieChart breakdown={data.expense_breakdown} />
            </div>
          </div>

          {/* Monthly line chart */}
          <div className="glass-card p-6 animate-slide-up stagger-4">
            <ChartHeader title="Monthly Trend" subtitle="Revenue, expenses & profit over time" icon="📈" />
            <MonthlyLineChart trend={data.monthly_trend} />
          </div>

          {/* Client table */}
          <div className="glass-card animate-slide-up stagger-4">
            <div className="p-6 border-b border-slate-800 flex items-start justify-between">
              <ChartHeader title="Client Breakdown" subtitle="Health · trends · sparklines · invoice aging" icon="👥" />
              <div className="flex items-center gap-3 text-xs font-mono text-slate-600 mt-1">
                {[['A','#34d399','Excellent'],['B','#22d3ee','Good'],['C','#fbbf24','Fair'],['D','#fb7185','At Risk']].map(([g,c,l]) => (
                  <span key={g} className="flex items-center gap-1">
                    <span style={{ color:c, fontWeight:700 }}>{g}</span>
                    <span style={{ color:'#475569' }}>{l}</span>
                  </span>
                ))}
              </div>
            </div>
            <ClientTable clients={data.clients} />
          </div>
        </div>
      )}
    </div>
  );
}

function ChartHeader({ title, subtitle, icon }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-1">
        <span>{icon}</span>
        <h2 className="text-white font-semibold" style={{ fontFamily:'DM Serif Display', fontSize:'1.1rem' }}>{title}</h2>
      </div>
      <p className="text-slate-500 text-xs font-mono">{subtitle}</p>
    </div>
  );
}
