import React, { useState } from 'react';

export default function ExportButtons({ dashboardRef, clients, filters }) {
  const [exporting, setExporting] = useState(false);

  // ── CSV export ────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const headers = ['Client', 'Revenue', 'Expenses', 'Profit', 'Margin %',
                     'Health Grade', 'MoM Trend %', 'Days Since Invoice', 'Invoice Status'];
    const rows = clients.map(c => [
      c.client,
      c.revenue,
      c.expenses,
      c.profit,
      c.margin.toFixed(1),
      c.health.grade,
      c.trend_pct,
      c.days_since_invoice === 9999 ? 'Never' : c.days_since_invoice,
      c.invoice_status,
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `profitability-report-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── PDF export ────────────────────────────────────────────────────────────
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

      pdf.save(`profitability-report-${new Date().toISOString().slice(0,10)}.pdf`);
    } catch (e) {
      console.error('PDF export failed:', e);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* CSV */}
      <button
        onClick={exportCSV}
        disabled={!clients?.length}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
        style={{
          background: 'rgba(52, 211, 153, 0.12)',
          border: '1px solid rgba(52, 211, 153, 0.3)',
          color: '#34d399',
          cursor: clients?.length ? 'pointer' : 'not-allowed',
          opacity: clients?.length ? 1 : 0.4,
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <polyline points="7 10 12 15 17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        CSV
      </button>

      {/* PDF */}
      <button
        onClick={exportPDF}
        disabled={exporting || !clients?.length}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
        style={{
          background: 'rgba(34, 211, 238, 0.12)',
          border: '1px solid rgba(34, 211, 238, 0.3)',
          color: '#22d3ee',
          cursor: (!exporting && clients?.length) ? 'pointer' : 'not-allowed',
          opacity: (!exporting && clients?.length) ? 1 : 0.4,
        }}
      >
        {exporting ? (
          <>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              border: '2px solid rgba(34,211,238,0.3)',
              borderTop: '2px solid #22d3ee',
              animation: 'spin 0.8s linear infinite',
            }} />
            Generating...
          </>
        ) : (
          <>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            PDF
          </>
        )}
      </button>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
