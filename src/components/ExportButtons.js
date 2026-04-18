import React, { useState } from 'react';
import * as XLSX from 'xlsx';

/* ─── helpers ────────────────────────────────────────────────────── */
const money  = (n) => (n == null ? 0 : Number(n));
const pct    = (n) => (n == null ? 0 : Number(n));
const fmtD   = () => new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });

/* Dark header style */
const HEADER_STYLE = {
  font:      { bold: true, color: { rgb: 'FFFFFF' }, name: 'Arial', sz: 11 },
  fill:      { fgColor: { rgb: '0F172A' }, patternType: 'solid' },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: {
    bottom: { style: 'medium', color: { rgb: '34D399' } },
  },
};

/* Alternating row fills */
const ROW_EVEN = { fill: { fgColor: { rgb: '0D1B2E' }, patternType: 'solid' } };
const ROW_ODD  = { fill: { fgColor: { rgb: '0A0F1E' }, patternType: 'solid' } };

const LABEL_STYLE = {
  font:      { bold: true, color: { rgb: '94A3B8' }, name: 'Arial', sz: 10 },
  alignment: { horizontal: 'left' },
};
const VALUE_STYLE = {
  font:      { bold: true, color: { rgb: 'FFFFFF' }, name: 'Arial', sz: 11 },
  alignment: { horizontal: 'right' },
};

function cellWithStyle(value, style, numFmt) {
  const c = { v: value, t: typeof value === 'number' ? 'n' : 's', s: style };
  if (numFmt) c.z = numFmt;
  return c;
}

function buildWorkbook(data) {
  const wb = XLSX.utils.book_new();
  const { summary = {}, clients = [], monthly_trend = [], expense_breakdown = [] } = data;
  const generated = fmtD();

  /* ── Sheet 1: Summary ─────────────────────────────────────────────── */
  const sumWs = XLSX.utils.aoa_to_sheet([]);

  const sumRows = [
    ['CLIENT PROFITABILITY REPORT', ''],
    [`Generated: ${generated}`, ''],
    [''],
    ['METRIC', 'VALUE'],
    ['Total Revenue',  money(summary.total_revenue)],
    ['Total Expenses', money(summary.total_expenses)],
    ['Net Profit',     money(summary.net_profit)],
    ['Profit Margin',  pct(summary.profit_margin) / 100],
  ];

  sumRows.forEach((row, ri) => {
    row.forEach((val, ci) => {
      const addr = XLSX.utils.encode_cell({ r: ri, c: ci });
      if (ri === 0) {
        sumWs[addr] = { v: val, t: 's', s: { font: { bold: true, sz: 16, color: { rgb: '34D399' }, name: 'Arial' } } };
      } else if (ri === 3) {
        sumWs[addr] = cellWithStyle(val, HEADER_STYLE);
      } else if (ri >= 4) {
        sumWs[addr] = ci === 0
          ? cellWithStyle(val, LABEL_STYLE)
          : cellWithStyle(val, VALUE_STYLE,
              ri === 7 ? '0.0%' : '$#,##0.00');
      } else {
        sumWs[addr] = { v: val, t: 's', s: { font: { color: { rgb: '64748B' }, name: 'Arial', sz: 10 } } };
      }
    });
  });

  sumWs['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: sumRows.length - 1, c: 1 } });
  sumWs['!cols'] = [{ wch: 22 }, { wch: 20 }];
  sumWs['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
  XLSX.utils.book_append_sheet(wb, sumWs, 'Summary');

  /* ── Sheet 2: Client Profitability ───────────────────────────────── */
  const clientHeaders = [
    'Rank', 'Client Name', 'Revenue ($)', 'Expenses ($)', 'Net Profit ($)',
    'Margin %', 'Health Grade', 'Health Label', 'MoM Trend %',
    'Trend Direction', 'Days Since Invoice', 'Last Invoice Date', 'Invoice Status',
  ];
  const clientRows = clients.map((c, i) => [
    i + 1,
    c.client,
    money(c.revenue),
    money(c.expenses),
    money(c.profit),
    pct(c.margin) / 100,
    c.health?.grade ?? '',
    c.health?.label ?? '',
    pct(c.trend_pct) / 100,
    c.trend_dir,
    c.days_since_invoice === 9999 ? 'Never' : c.days_since_invoice,
    c.last_invoice_date,
    c.invoice_status,
  ]);

  const clientWs = XLSX.utils.aoa_to_sheet([clientHeaders, ...clientRows]);

  // Style header row
  clientHeaders.forEach((_, ci) => {
    const addr = XLSX.utils.encode_cell({ r: 0, c: ci });
    if (clientWs[addr]) clientWs[addr].s = HEADER_STYLE;
  });

  // Style data rows
  clientRows.forEach((row, ri) => {
    const rowStyle = ri % 2 === 0 ? ROW_EVEN : ROW_ODD;
    row.forEach((val, ci) => {
      const addr = XLSX.utils.encode_cell({ r: ri + 1, c: ci });
      if (!clientWs[addr]) return;
      const baseStyle = { ...rowStyle, font: { name: 'Arial', sz: 10, color: { rgb: 'E2E8F0' } }, alignment: { horizontal: ci <= 1 ? 'left' : 'right' } };
      let numFmt = null;
      if (ci === 2 || ci === 3 || ci === 4) numFmt = '$#,##0.00';
      if (ci === 5 || ci === 8)             numFmt = '0.0%';
      if (ci === 6) {
        const grade = val;
        const gradeColor = grade === 'A' ? '34D399' : grade === 'B' ? '22D3EE' : grade === 'C' ? 'FBBF24' : 'FB7185';
        baseStyle.font = { ...baseStyle.font, bold: true, color: { rgb: gradeColor } };
      }
      clientWs[addr].s = baseStyle;
      if (numFmt) clientWs[addr].z = numFmt;
    });
  });

  clientWs['!cols'] = [
    { wch: 6 }, { wch: 22 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
    { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 12 },
    { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, clientWs, 'Client Profitability');

  /* ── Sheet 3: Monthly Trend ──────────────────────────────────────── */
  const trendHeaders = ['Month', 'Revenue ($)', 'Expenses ($)', 'Net Profit ($)'];
  const trendRows = monthly_trend.map(m => [
    m.month,
    money(m.revenue),
    money(m.expenses),
    money(m.profit),
  ]);

  const trendWs = XLSX.utils.aoa_to_sheet([trendHeaders, ...trendRows]);
  trendHeaders.forEach((_, ci) => {
    const addr = XLSX.utils.encode_cell({ r: 0, c: ci });
    if (trendWs[addr]) trendWs[addr].s = HEADER_STYLE;
  });
  trendRows.forEach((_, ri) => {
    [1, 2, 3].forEach(ci => {
      const addr = XLSX.utils.encode_cell({ r: ri + 1, c: ci });
      if (trendWs[addr]) {
        trendWs[addr].s = {
          ...(ri % 2 === 0 ? ROW_EVEN : ROW_ODD),
          font: { name: 'Arial', sz: 10, color: { rgb: ci === 3 ? (trendRows[ri][3] >= 0 ? '34D399' : 'FB7185') : 'E2E8F0' } },
          alignment: { horizontal: 'right' },
        };
        trendWs[addr].z = '$#,##0.00';
      }
    });
    // Month cell
    const mAddr = XLSX.utils.encode_cell({ r: ri + 1, c: 0 });
    if (trendWs[mAddr]) {
      trendWs[mAddr].s = { ...(ri % 2 === 0 ? ROW_EVEN : ROW_ODD), font: { name: 'Arial', sz: 10, color: { rgb: '94A3B8' } } };
    }
  });
  trendWs['!cols'] = [{ wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, trendWs, 'Monthly Trend');

  /* ── Sheet 4: Expense Breakdown ──────────────────────────────────── */
  const totalExp = expense_breakdown.reduce((s, e) => s + e.amount, 0);
  const expHeaders = ['Category', 'Amount ($)', '% of Total'];
  const expRows = expense_breakdown.map(e => [
    e.category,
    money(e.amount),
    totalExp > 0 ? e.amount / totalExp : 0,
  ]);

  const expWs = XLSX.utils.aoa_to_sheet([expHeaders, ...expRows]);
  expHeaders.forEach((_, ci) => {
    const addr = XLSX.utils.encode_cell({ r: 0, c: ci });
    if (expWs[addr]) expWs[addr].s = HEADER_STYLE;
  });
  expRows.forEach((_, ri) => {
    const catAddr = XLSX.utils.encode_cell({ r: ri + 1, c: 0 });
    const amtAddr = XLSX.utils.encode_cell({ r: ri + 1, c: 1 });
    const pctAddr = XLSX.utils.encode_cell({ r: ri + 1, c: 2 });
    const rowStyle = ri % 2 === 0 ? ROW_EVEN : ROW_ODD;
    if (expWs[catAddr]) { expWs[catAddr].s = { ...rowStyle, font: { name: 'Arial', sz: 10, color: { rgb: 'E2E8F0' } } }; }
    if (expWs[amtAddr]) { expWs[amtAddr].s = { ...rowStyle, font: { name: 'Arial', sz: 10, color: { rgb: 'FB7185' } }, alignment: { horizontal: 'right' } }; expWs[amtAddr].z = '$#,##0.00'; }
    if (expWs[pctAddr]) { expWs[pctAddr].s = { ...rowStyle, font: { name: 'Arial', sz: 10, color: { rgb: '94A3B8' } }, alignment: { horizontal: 'right' } }; expWs[pctAddr].z = '0.0%'; }
  });
  expWs['!cols'] = [{ wch: 28 }, { wch: 16 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, expWs, 'Expense Breakdown');

  return wb;
}

/* ─── Component ──────────────────────────────────────────────────── */
export default function ExportButtons({ dashboardRef, data }) {
  const [exportingPDF,  setExportingPDF]  = useState(false);
  const [exportingXLSX, setExportingXLSX] = useState(false);

  const clients = data?.clients ?? [];

  /* ── Excel ── */
  const exportExcel = async () => {
    if (!clients.length) return;
    setExportingXLSX(true);
    try {
      const wb       = buildWorkbook(data);
      const filename = `profitability-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, filename, { bookType: 'xlsx', type: 'binary', cellStyles: true });
    } catch (e) {
      console.error('Excel export failed:', e);
    } finally {
      setExportingXLSX(false);
    }
  };

  /* ── PDF ── */
  const exportPDF = async () => {
    if (!clients.length) return;
    setExportingPDF(true);
    try {
      const { default: jsPDF }       = await import('jspdf');
      const { default: html2canvas } = await import('html2canvas');
      const el = dashboardRef.current;
      if (!el) return;
      const canvas  = await html2canvas(el, { scale: 1.5, useCORS: true, backgroundColor: '#0a0f1e', logging: false });
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
      setExportingPDF(false);
    }
  };

  const btn = (onClick, disabled, color, children, title) => (
    <button onClick={onClick} disabled={disabled} title={title}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
        background: `rgba(${color},0.12)`,
        border: `1px solid rgba(${color},0.35)`,
        color: `rgb(${color})`,
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s',
        whiteSpace: 'nowrap',
      }}>
      {children}
    </button>
  );

  const spinner = (color) => (
    <div style={{
      width: 10, height: 10, borderRadius: '50%',
      border: `2px solid rgba(${color},0.25)`,
      borderTop: `2px solid rgb(${color})`,
      animation: 'spin 0.8s linear infinite',
    }} />
  );

  const xlsxIcon = (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="8" y1="13" x2="16" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="8" y1="17" x2="16" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );

  const pdfIcon = (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {btn(exportExcel, exportingXLSX || !clients.length, '52,211,153',
        exportingXLSX ? <>{spinner('52,211,153')} Building Excel...</> : <>{xlsxIcon} Export Excel</>,
        '4-sheet Excel: Summary · Clients · Monthly Trend · Expense Breakdown')}

      {btn(exportPDF, exportingPDF || !clients.length, '34,211,238',
        exportingPDF ? <>{spinner('34,211,238')} Generating PDF...</> : <>{pdfIcon} Export PDF</>,
        'Full dashboard screenshot as PDF')}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
