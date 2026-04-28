import React, { useState, useRef } from 'react';
import axios from 'axios';
import API from '../config';

const SAMPLE_CSV = `Date,Vendor,Memo,Amount,Category
2024-01-05,Bob's Burger Joint,Team lunch after project kickoff,54.20,Meals & Entertainment
2024-01-08,Amazon Web Services,EC2 compute - January billing,1240.00,Cloud & Hosting
2024-01-10,Adobe Inc,Creative Cloud annual subscription,599.88,Software & Subscriptions
2024-01-12,Pacific Gas & Electric,Office electricity bill - January,312.45,Utilities
2024-01-15,United Airlines,Flight to client site - SFO to LAX,389.00,Travel & Transportation
2024-01-18,Staples,Printer paper and office supplies,87.32,Office Supplies & Equipment
2024-01-20,Robertson & Associates,Monthly bookkeeping services,450.00,Legal & Professional Fees
2024-01-22,Brosnahan Insurance Agency,General liability insurance premium,2000.00,Insurance
2024-01-25,Google Ads,January PPC campaign - landscaping,1500.00,Advertising & Marketing
2024-01-28,Hall Properties,Office rent - January,900.00,Rent & Facilities
2024-02-02,Bob's Burger Joint,Crew lunch - site visit,43.50,Meals & Entertainment
2024-02-05,Amazon Web Services,EC2 and S3 storage - February,1380.00,Cloud & Hosting
2024-02-08,Slack Technologies,Team messaging annual plan,960.00,Software & Subscriptions
2024-02-12,AT&T,Office telephone and internet,185.00,Utilities
2024-02-15,Marriott Hotels,Hotel stay - client meeting Sacramento,245.00,Travel & Transportation
2024-02-18,Home Depot,Landscaping tools and materials,634.00,Materials & Inventory
2024-02-20,Robertson & Associates,Bookkeeping - February,450.00,Legal & Professional Fees
2024-02-22,Brosnahan Insurance Agency,Workers compensation premium,1800.00,Insurance
2024-02-25,Facebook Ads,February social media ad campaign,800.00,Advertising & Marketing
2024-02-28,Hall Properties,Office rent - February,900.00,Rent & Facilities
2024-03-01,Bob's Burger Joint,Lunch with potential client,67.80,Meals & Entertainment
2024-03-04,Amazon Web Services,AWS infrastructure - March,1190.00,Cloud & Hosting
2024-03-06,GitHub Inc,GitHub Teams plan - annual,444.00,Software & Subscriptions
2024-03-10,Pacific Gas & Electric,Electricity - March,298.70,Utilities
2024-03-14,Uber,Client site visits - March rides,156.40,Travel & Transportation
2024-03-18,Granite Suppliers Co,Stone and gravel for fountain project,2340.00,Materials & Inventory
2024-03-20,Robertson & Associates,Tax preparation and filing,1200.00,Legal & Professional Fees
2024-03-22,State Farm Insurance,Vehicle insurance - company truck,380.00,Insurance
2024-03-25,Google Ads,March PPC campaign,1750.00,Advertising & Marketing
2024-03-28,Hall Properties,Office rent - March,900.00,Rent & Facilities
2024-04-02,Chipotle,Working lunch - crew of 4,58.40,Meals & Entertainment
2024-04-05,Amazon Web Services,AWS - April billing,1420.00,Cloud & Hosting
2024-04-08,Zoom Video,Zoom Pro annual subscription,179.90,Software & Subscriptions
2024-04-12,AT&T,Telephone and internet - April,185.00,Utilities
2024-04-15,Delta Airlines,Flight - project site inspection,412.00,Travel & Transportation
2024-04-18,Home Depot,Plants soil and garden materials,1890.00,Materials & Inventory
2024-04-20,Tim Philip Masonry,Subcontractor - retaining wall project,3500.00,Legal & Professional Fees
2024-04-22,Brosnahan Insurance Agency,Monthly premium installment,666.00,Insurance
2024-04-25,Yelp Advertising,Local business ad campaign,400.00,Advertising & Marketing
2024-04-28,Hall Properties,Office rent - April,900.00,Rent & Facilities
2024-05-02,Bob's Burger Joint,Lunch - team debrief,49.90,Meals & Entertainment
2024-05-05,Amazon Web Services,AWS compute and RDS - May,1560.00,Cloud & Hosting
2024-05-08,Figma,Design tool annual plan,576.00,Software & Subscriptions
2024-05-12,Pacific Gas & Electric,Electricity - May,275.80,Utilities
2024-05-16,Hertz Car Rental,Vehicle rental - site visits,320.00,Travel & Transportation
2024-05-20,Granite Suppliers Co,Gravel and decorative stone,1780.00,Materials & Inventory
2024-05-22,Robertson & Associates,Bookkeeping - May,450.00,Legal & Professional Fees
2024-05-24,Brosnahan Insurance Agency,Equipment insurance premium,520.00,Insurance
2024-05-28,Google Ads,May campaign - spring promotion,2100.00,Advertising & Marketing
2024-05-30,Hall Properties,Office rent - May,900.00,Rent & Facilities
2024-06-03,Starbucks,Coffee meeting with new client,32.50,Meals & Entertainment
2024-06-06,Amazon Web Services,AWS - June billing,1310.00,Cloud & Hosting
2024-06-09,Asana,Project management tool - annual,559.88,Software & Subscriptions
2024-06-12,AT&T,Telephone and internet - June,185.00,Utilities
2024-06-16,Southwest Airlines,Flight to trade show - Las Vegas,278.00,Travel & Transportation
2024-06-18,Home Depot,Summer planting materials and tools,2210.00,Materials & Inventory
2024-06-20,Tim Philip Masonry,Subcontractor - patio project phase 2,4200.00,Legal & Professional Fees
2024-06-22,State Farm Insurance,Quarterly vehicle insurance,380.00,Insurance
2024-06-26,Google Ads,June ad campaign - summer sale,1900.00,Advertising & Marketing
2024-06-28,Hall Properties,Office rent - June,900.00,Rent & Facilities`;

function downloadCSV() {
  const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'sample_vendor_expenses.csv'; a.click();
  URL.revokeObjectURL(url);
}

export default function UploadPage({ onUploadSuccess }) {
  const [dragging,  setDragging]  = useState(false);
  const [file,      setFile]      = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error,     setError]     = useState(null);
  const [progress,  setProgress]  = useState(0);
  const inputRef = useRef();

  const validateAndSet = (f) => {
    setError(null);
    if (!f.name.match(/\.(csv|xlsx|xls)$/i)) {
      setError('Please upload a CSV or Excel file (.csv, .xlsx, .xls)');
      return;
    }
    setFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true); setError(null); setProgress(0);
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await axios.post(`${API}/upload`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => setProgress(Math.round((e.loaded / e.total) * 100)),
      });
      onUploadSuccess(res.data);
    } catch (err) {
      const msg = err.response?.data?.detail || 'Upload failed. Please try again.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setUploading(false);
    }
  };

  const fmtSize = (b) => b < 1024 ? b + ' B' : b < 1048576 ? (b/1024).toFixed(1) + ' KB' : (b/1048576).toFixed(1) + ' MB';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
      {/* Hero */}
      <div className="text-center mb-12 animate-fade-in">
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:12, marginBottom:16 }}>
          <div style={{ width:52, height:52, borderRadius:14,
            background:'linear-gradient(135deg,#38bdf8,#818cf8)',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:24 }}>
            🔍
          </div>
          <span className="text-slate-300 font-semibold text-xl" style={{ fontFamily:'DM Serif Display' }}>
            VendorLens
          </span>
        </div>
        <h1 style={{ fontFamily:'DM Serif Display', fontSize:'2.8rem', color:'white', lineHeight:1.15, marginBottom:12 }}>
          Vendor Expense<br/>
          <span className="gradient-text">Reconciliation</span>
        </h1>
        <p className="text-slate-400 text-base max-w-lg mx-auto">
          Upload your QuickBooks <strong style={{ color:'#38bdf8' }}>Transaction List by Vendor</strong> and
          instantly verify whether every transaction's <strong style={{ color:'#c4b5fd' }}>Split category</strong> matches
          what the vendor and memo actually describe — powered by web search.
        </p>
      </div>

      {/* Upload card */}
      <div className="glass-card w-full max-w-xl p-8 animate-slide-up">
        <div
          className={`upload-zone rounded-xl p-12 text-center cursor-pointer ${dragging ? 'active' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) validateAndSet(f); }}
          onClick={() => inputRef.current?.click()}
        >
          <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
            onChange={(e) => validateAndSet(e.target.files[0])} />
          {file ? (
            <div className="flex flex-col items-center gap-3">
              <div style={{ width:56, height:56, borderRadius:14,
                background:'rgba(56,189,248,0.15)', border:'1px solid rgba(56,189,248,0.3)',
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:26 }}>📄</div>
              <div>
                <p className="text-white font-medium">{file.name}</p>
                <p className="text-slate-400 text-sm mt-1">{fmtSize(file.size)}</p>
              </div>
              <button className="text-xs text-slate-500 hover:text-slate-300 underline"
                onClick={(e) => { e.stopPropagation(); setFile(null); }}>
                Change file
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div style={{ width:64, height:64, borderRadius:16,
                background:'rgba(30,41,59,0.8)', border:'1px solid #334155',
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:28 }}>📂</div>
              <div>
                <p className="text-slate-300 font-medium">Drop your file here</p>
                <p className="text-slate-500 text-sm mt-1">or click to browse</p>
              </div>
              <div className="flex gap-2">
                {['.CSV', '.XLSX', '.XLS'].map(ext => (
                  <span key={ext} className="px-2 py-1 rounded-md text-xs font-mono text-slate-400"
                    style={{ background:'rgba(51,65,85,0.5)', border:'1px solid #334155' }}>{ext}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {uploading && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-slate-400 mb-2">
              <span>Processing…</span><span>{progress}%</span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-300"
                style={{ width:`${progress}%`, background:'linear-gradient(90deg,#38bdf8,#818cf8)' }} />
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 px-4 py-3 rounded-lg text-sm text-rose-300"
            style={{ background:'rgba(244,63,94,0.1)', border:'1px solid rgba(244,63,94,0.2)' }}>
            ⚠ {error}
          </div>
        )}

        <button onClick={handleUpload} disabled={!file || uploading}
          className="mt-6 w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-200"
          style={{
            background: file && !uploading ? 'linear-gradient(135deg,#38bdf8,#818cf8)' : 'rgba(51,65,85,0.5)',
            color: file && !uploading ? '#0a0f1e' : '#475569',
            cursor: file && !uploading ? 'pointer' : 'not-allowed', border:'none',
          }}>
          {uploading ? 'Processing…' : 'Analyse Expenses →'}
        </button>
      </div>

      {/* What it detects */}
      <div className="mt-10 text-center animate-fade-in max-w-xl">
        <p className="text-slate-500 text-xs font-mono uppercase tracking-wider mb-4">AUTO-DETECTED FORMATS</p>
        <div className="flex flex-wrap justify-center gap-3 mb-6">
          {[
            { icon:'📊', label:'QuickBooks Transaction List by Vendor (XLSX)' },
            { icon:'📋', label:'QuickBooks CSV export' },
            { icon:'📄', label:'Custom vendor expense CSV' },
          ].map(({ icon, label }) => (
            <div key={label} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 14px',
              borderRadius:10, background:'rgba(15,23,42,0.8)', border:'1px solid #334155' }}>
              <span>{icon}</span>
              <span className="text-slate-400 text-xs">{label}</span>
            </div>
          ))}
        </div>
        <p className="text-slate-600 text-xs mb-1">
          QuickBooks: <span style={{ color:'#38bdf8' }}>Reports → Expenses → Transaction List by Vendor → Export</span>
        </p>
        <p className="text-slate-600 text-xs">
          The <span style={{ color:'#c4b5fd' }}>Split</span> column is used as the assigned category for reconciliation.
        </p>

        {/* Download buttons */}
        <div className="flex gap-3 justify-center mt-6">
          <button onClick={downloadCSV}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px',
              borderRadius:8, fontSize:12, fontWeight:500, cursor:'pointer',
              background:'rgba(56,189,248,0.1)', border:'1px solid rgba(56,189,248,0.3)',
              color:'#38bdf8' }}>
            ↓ Download Sample CSV
          </button>
        </div>
      </div>
    </div>
  );
}
