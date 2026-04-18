import React, { useState } from 'react';

const fmtMoney = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);

export default function ExportButtons({ dashboardRef, data }) {
  const [exporting, setExporting] = useState(false);

  const { clients = [], summary = {}, monthly_trend = [], expense_breakdown = [] } = data || {};

  // ── CSV — multi-section full dashboard export ─────────────────────────────
  const exportCSV = () => {
    const lines = [];
    const date  = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    // ── Section 1: Summary ────────────────────────────────────────────────
    lines.push('PROFITABILITY REPORT');
    lines.push(`Generated:,${date}`);
    lines.push('');
    lines.push('=== SUMMARY ===');
    lines.push('Metric,Value');
    lines.push(`Total Revenue,${fmtMoney(summary.total_revenue ?? 0)}`);
    lines.push(`Total Expenses,${fmtMoney(summary.total_expenses ?? 0)}`);
    lines.push(`Net Profit,${fmtMoney(summary.net_profit ?? 0)}`);
    lines.push(`Profit Margin,${(summary.profit_margin ?? 0).toFixed(1)}%`);
    lines.push('');

    // ── Section 2: Client Table ───────────────────────────────────────────
    lines.push('=== CLIENT PROFITABILITY ===');
    lines.push([
      'Rank', 'Client', 'Revenue', 'Expenses', 'Net Profit',
      'Margin %', 'Health Grade', 'Health Label',
      'MoM Trend %', 'Trend Direction',
      'Days Since Last Invoice', 'Last Invoice Date', 'Invoice Status',
    ].join(','));

    clients.forEach((c, i) => {
      lines.push([
        i + 1,
        `"${c.client}"`,
        fmtMoney(c.revenue),
        fmtMoney(c.expenses),
        fmtMoney(c.profit),
        `${c.margin.toFixed(1)}%`,
        c.health?.grade ?? '',
        c.health?.label ?? '',
        `${c.trend_pct >= 0 ? '+' : ''}${c.trend_pct}%`,
        c.trend_dir,
        c.days_since_invoice === 9999 ? 'Never' : c.days_since_invoice,
        c.last_invoice_date,
        c.invoice_status,
      ].join(','));
    });
    lines.push('');

    // ── Section 3: Monthly Trend ──────────────────────────────────────────
    lines.push('=== MONTHLY TREND ===');
    lines.push('Month,Revenue,Expenses,Net Profit');
    monthly_trend.forEach(m => {
      lines.push([
        m.month,
        fmtMoney(m.revenue),
        fmtMoney(m.expenses),
        fmtMoney(m.profit),
      ].join(','));
    });
    lines.push('');

    // ── Section 4: Expense Breakdown ─────────────────────────────────────
    lines.push('=== EXPENSE BREAKDOWN BY CATEGORY ===');
    lines.push('Category,Amount,% of Total Expenses');
    const totalExp = expense_breakdown.reduce((s, e) => s + e.amount, 0);
    expense_breakdown.forEach(e => {
      const pct = totalExp > 0 ? ((e.amount / totalExp) * 100).toFixed(1) : '0.0';
      lines.push([`"${e.category}"`, fmtMoney(e.amount), `${pct}%`].join(','));
    });

    // Download
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `profitability-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── PDF — capture full dashboard ─────────────────────────────────────────
  const exportPDF = async () => {
    setExporting(true);
    try {
      const { default: jsPDF }       = await import('jspdf');
      const { default: html2canvas } = await import('html2canvas');
      const el = dashboardRef.current;
      if (!el) return;

      const canvas = await html2canvas(el, {
        scale: 1.5,
        useCORS: true,
        backgroundColor: '#0a0f1e',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf     = new jsPDF({ orientation: 'landscape', unit: 'px', format: 'a4' });
      const pdfW    = pdf.internal.pageSize.getWidth();
      const pdfH    = (canvas.height * pdfW) / canvas.width;
      let   yPos    = 0;
      const pageH   = pdf.internal.pageSize.getHeight();

      while (yPos < pdfH) {
        if (yPos > 0) pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, -yPos, pdfW, pdfH);
        yPos += pageH;
      }
      pdf.save(`profitability-report-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e) {
      console.error('PDF export failed:', e);
    } finally {
      setExporting(false);
    }
  };

  const btnBase = {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '6px 12px', borderRadius: 8,
    fontSize: 12, fontWeight: 500, cursor: 'pointer',
    transition: 'all 0.2s',
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {/* CSV */}
      <button
        onClick={exportCSV}
        disabled={!clients?.length}
        style={{
          ...btnBase,
          background: 'rgba(52,211,153,0.12)',
          border: '1px solid rgba(52,211,153,0.3)',
          color: '#34d399',
          opacity: clients?.length ? 1 : 0.4,
          cursor: clients?.length ? 'pointer' : 'not-allowed',
        }}
        title="Download full report as CSV (includes summary, client table, monthly trend, expense breakdown)"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <polyline points="7 10 12 15 17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        Export CSV
      </button>

      {/* PDF */}
      <button
        onClick={exportPDF}
        disabled={exporting || !clients?.length}
        style={{
          ...btnBase,
          background: 'rgba(34,211,238,0.12)',
          border: '1px solid rgba(34,211,238,0.3)',
          color: '#22d3ee',
          opacity: (!exporting && clients?.length) ? 1 : 0.4,
          cursor: (!exporting && clients?.length) ? 'pointer' : 'not-allowed',
        }}
        title="Download full dashboard as PDF"
      >
        {exporting ? (
          <>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              border: '2px solid rgba(34,211,238,0.3)',
              borderTop: '2px solid #22d3ee',
              animation: 'spin 0.8s linear infinite',
            }} />
            Generating PDF...
          </>
        ) : (
          <>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Export PDF
          </>
        )}
      </button>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
