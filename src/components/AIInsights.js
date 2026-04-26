import React, { useState } from 'react';
import axios from 'axios';
import API from '../config';

const Section = ({ icon, title, items, color, bg, border }) => (
  <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: '16px 20px' }}>
    <div className="flex items-center gap-2 mb-3">
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span className="text-xs font-mono uppercase tracking-wider" style={{ color }}>{title}</span>
    </div>
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm" style={{ color: '#cbd5e1', lineHeight: 1.5 }}>
          <span style={{ color, flexShrink: 0, marginTop: 2 }}>›</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  </div>
);

export default function AIInsights({ data }) {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);

  const generate = async () => {
    setLoading(true); setError(null);
    try {
      const res = await axios.post(`${API}/ai-insights`, {
        summary:        data.summary,
        clients:        data.clients,
        invoice_alerts: data.invoice_alerts,
      });
      setInsights(res.data);
    } catch (e) {
      setError('Could not generate insights. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card animate-slide-up" style={{ border: '1px solid rgba(168,139,250,0.25)' }}>
      {/* Header */}
      <div className="flex items-center justify-between p-6" style={{ borderBottom: insights ? '1px solid rgba(30,41,59,0.8)' : 'none' }}>
        <div className="flex items-center gap-3">
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(168,139,250,0.12)',
            border: '1px solid rgba(168,139,250,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
            ✨
          </div>
          <div>
            <h3 className="text-white font-semibold" style={{ fontFamily: 'DM Serif Display', fontSize: '1rem' }}>
              AI Business Intelligence
            </h3>
            <p className="text-slate-500 text-xs font-mono mt-0.5">
              {insights
                ? (insights.source === 'claude' ? '✦ Powered by Claude AI' : '◎ Smart rule-based analysis')
                : 'Deep analysis of your profitability data'}
            </p>
          </div>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
            background: loading ? 'rgba(168,139,250,0.08)' : 'linear-gradient(135deg, rgba(168,139,250,0.25), rgba(139,92,246,0.35))',
            border: '1px solid rgba(168,139,250,0.4)',
            color: '#c4b5fd', cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s', opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? (
            <>
              <div style={{ width: 12, height: 12, borderRadius: '50%',
                border: '2px solid rgba(168,139,250,0.3)', borderTop: '2px solid #c4b5fd',
                animation: 'spin 0.8s linear infinite' }} />
              Analyzing…
            </>
          ) : (
            <>✨ {insights ? 'Regenerate' : 'Generate Insights'}</>
          )}
        </button>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="p-6 space-y-4">
          {[100, 80, 90].map((w, i) => (
            <div key={i} style={{ height: 12, borderRadius: 6, width: `${w}%`,
              background: 'linear-gradient(90deg, #1e293b, #334155, #1e293b)',
              backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
          ))}
          <div className="grid grid-cols-3 gap-4 mt-4">
            {[1,2,3].map(i => (
              <div key={i} style={{ height: 80, borderRadius: 10, background: '#1e293b' }} />
            ))}
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="p-6 text-sm text-rose-400">{error}</div>
      )}

      {/* Results */}
      {insights && !loading && (
        <div className="p-6 space-y-5">
          {/* Executive summary */}
          <div style={{ background: 'rgba(168,139,250,0.07)', border: '1px solid rgba(168,139,250,0.2)',
            borderRadius: 12, padding: '16px 20px' }}>
            <p className="text-xs font-mono uppercase tracking-wider mb-2" style={{ color: '#a78bfa' }}>Executive Summary</p>
            <p className="text-slate-200 text-sm leading-relaxed">{insights.executive_summary}</p>
          </div>

          {/* 3-column grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Section icon="🏆" title="What's Working"  items={insights.wins}    color="#34d399" bg="rgba(52,211,153,0.05)"   border="rgba(52,211,153,0.2)" />
            <Section icon="⚠️" title="Risks to Watch"  items={insights.risks}   color="#fbbf24" bg="rgba(251,191,36,0.05)"  border="rgba(251,191,36,0.2)" />
            <Section icon="🎯" title="Action Items"    items={insights.actions} color="#38bdf8" bg="rgba(56,189,248,0.05)"  border="rgba(56,189,248,0.2)" />
          </div>

          {/* Key metric spotlight */}
          <div style={{ background: 'linear-gradient(135deg, rgba(168,139,250,0.08), rgba(99,102,241,0.08))',
            border: '1px solid rgba(168,139,250,0.2)', borderRadius: 12, padding: '16px 20px',
            display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ fontSize: 20, flexShrink: 0 }}>💡</div>
            <div>
              <p className="text-xs font-mono uppercase tracking-wider mb-1.5" style={{ color: '#a78bfa' }}>Key Metric to Watch</p>
              <p className="text-slate-200 text-sm leading-relaxed">{insights.key_metric}</p>
            </div>
          </div>
        </div>
      )}

      {/* Idle prompt */}
      {!insights && !loading && (
        <div className="px-6 pb-6 pt-2 text-center">
          <p className="text-slate-600 text-xs">
            Click <span style={{ color: '#c4b5fd' }}>Generate Insights</span> to get a plain-English analysis
            of your business health, risks, and actionable next steps.
          </p>
        </div>
      )}

      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes spin { to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}
