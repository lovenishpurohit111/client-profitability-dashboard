import React, { useState, useRef } from 'react';
import axios from 'axios';
import API from '../config';

const SAMPLE_CSV = `Date,Client Name,Memo,Amount,Category
2024-01-05,Acme Corp,Initial payment for homepage redesign and branding refresh,15000,Revenue
2024-01-08,Acme Corp,AWS EC2 monthly server hosting fee,1200,Expenses
2024-01-10,Globex Inc,Milestone 1 payment - iOS and Android app development,32000,Revenue
2024-01-12,Globex Inc,Google Cloud infrastructure setup and deployment,4500,Expenses
2024-01-15,Initech Ltd,Q1 SEO audit and keyword optimisation campaign,8000,Revenue
2024-01-18,Initech Ltd,Ahrefs and SEMrush annual subscription,600,Expenses
2024-01-20,Umbrella Co,Client analytics dashboard - Phase 1 delivery,22000,Revenue
2024-01-22,Umbrella Co,Tableau and Power BI software licences,1800,Expenses
2024-01-25,Stark Industries,AI chatbot integration with CRM system,45000,Revenue
2024-01-28,Stark Industries,GPU compute costs for model training runs,8000,Expenses
2024-01-30,Pinnacle Group,Brand identity and logo design project,12500,Revenue
2024-01-31,Pinnacle Group,Adobe Creative Cloud team subscription,900,Expenses
2024-02-02,Acme Corp,UI redesign Phase 2 - component library build,12000,Revenue
2024-02-05,Acme Corp,Figma Pro and design asset licences,900,Expenses
2024-02-07,Globex Inc,REST API development and third-party integrations,18000,Revenue
2024-02-10,Globex Inc,Stripe and Twilio API usage fees,2200,Expenses
2024-02-12,Initech Ltd,February content marketing retainer,5000,Revenue
2024-02-14,Initech Ltd,Content creation tools and Canva Pro,400,Expenses
2024-02-18,Umbrella Co,Backend performance optimisation sprint,11000,Revenue
2024-02-20,Umbrella Co,DataDog monitoring and DevOps tooling,1100,Expenses
2024-02-22,Stark Industries,NLP-based document classification model,38000,Revenue
2024-02-25,Stark Industries,AWS S3 data storage and processing,5500,Expenses
2024-02-27,Pinnacle Group,Social media management - Feb retainer,6000,Revenue
2024-02-28,Pinnacle Group,Hootsuite and scheduling tool subscriptions,350,Expenses
2024-02-29,Nexon Digital,E-commerce platform build - Shopify custom theme,27000,Revenue
2024-02-29,Nexon Digital,Shopify app subscriptions and payment gateway,1400,Expenses
2024-03-01,Acme Corp,E-commerce checkout module development,20000,Revenue
2024-03-04,Acme Corp,Stripe payment gateway integration fee,800,Expenses
2024-03-06,Globex Inc,Security audit and penetration testing report,14000,Revenue
2024-03-09,Globex Inc,Burp Suite Pro and security scanning tools,3000,Expenses
2024-03-12,Initech Ltd,Google Ads PPC campaign management - Q1,9500,Revenue
2024-03-15,Initech Ltd,Google Ads spend - March campaign budget,2000,Expenses
2024-03-18,Umbrella Co,Salesforce CRM integration and custom workflows,16000,Revenue
2024-03-21,Umbrella Co,Salesforce CRM licence fee,2400,Expenses
2024-03-24,Stark Industries,Deep learning image recognition pipeline,52000,Revenue
2024-03-27,Stark Industries,Research compute cluster and GPU rental,9000,Expenses
2024-03-28,Pinnacle Group,Brand refresh campaign creative and copy,11000,Revenue
2024-03-29,Pinnacle Group,Stock photography and creative asset licences,900,Expenses
2024-03-30,Nexon Digital,Product catalogue migration and SEO setup,9500,Revenue
2024-03-31,Nexon Digital,Yoast SEO Premium and content plugin suite,450,Expenses
2024-04-02,Acme Corp,Mobile responsive updates across all pages,9000,Revenue
2024-04-05,Acme Corp,BrowserStack cross-device testing subscription,700,Expenses
2024-04-08,Globex Inc,CI/CD pipeline setup with GitHub Actions,21000,Revenue
2024-04-11,Globex Inc,GitHub Teams plan and deployment tooling,1500,Expenses
2024-04-14,Initech Ltd,LinkedIn and Meta social media management - April,6000,Revenue
2024-04-17,Initech Ltd,Buffer scheduling and social analytics tools,350,Expenses
2024-04-20,Umbrella Co,Custom KPI reporting dashboard delivery,13000,Revenue
2024-04-23,Umbrella Co,Looker Studio Pro and reporting software,950,Expenses
2024-04-26,Stark Industries,NLP sentiment analysis engine - final delivery,41000,Revenue
2024-04-29,Stark Industries,Cloud GPU rental for inference testing,7500,Expenses
2024-04-30,Pinnacle Group,April content retainer - blog and email,5500,Revenue
2024-04-30,Pinnacle Group,Mailchimp and email automation platform,480,Expenses
2024-04-30,Nexon Digital,April e-commerce maintenance and support,4000,Revenue
2024-04-30,Nexon Digital,Hosting and CDN fees for store,600,Expenses
2024-05-03,Acme Corp,CMS development - WordPress custom theme,17000,Revenue
2024-05-06,Acme Corp,WP Engine managed hosting plan,1100,Expenses
2024-05-09,Globex Inc,Application performance optimisation sprint,11500,Revenue
2024-05-12,Globex Inc,New Relic APM and profiling subscription,600,Expenses
2024-05-15,Initech Ltd,Email marketing campaign design and send,4500,Revenue
2024-05-18,Initech Ltd,Klaviyo email platform monthly fee,500,Expenses
2024-05-21,Umbrella Co,Legacy data migration to new cloud warehouse,19000,Revenue
2024-05-24,Umbrella Co,AWS Glue ETL and migration tooling,1600,Expenses
2024-05-27,Stark Industries,Computer vision quality control system,47000,Revenue
2024-05-30,Stark Industries,Labelled dataset licensing from third party,6000,Expenses
2024-05-31,Pinnacle Group,Influencer campaign strategy and execution,8500,Revenue
2024-05-31,Pinnacle Group,Influencer management platform subscription,650,Expenses
2024-05-31,Nexon Digital,Conversion rate optimisation audit and fixes,7500,Revenue
2024-05-31,Nexon Digital,Hotjar heatmap and session recording tool,290,Expenses
2024-06-03,Acme Corp,Google Analytics 4 integration and event tracking,14000,Revenue
2024-06-06,Acme Corp,GA4 and analytics platform licence,1300,Expenses
2024-06-09,Globex Inc,Microservices architecture redesign - Phase 1,28000,Revenue
2024-06-12,Globex Inc,Docker Hub and container registry hosting,3500,Expenses
2024-06-15,Initech Ltd,H1 brand refresh campaign creative direction,11000,Revenue
2024-06-18,Initech Ltd,Creative tool subscriptions and font licences,900,Expenses
2024-06-21,Umbrella Co,API gateway configuration and load balancing,15000,Revenue
2024-06-24,Umbrella Co,Kong API management platform licence,1200,Expenses
2024-06-27,Stark Industries,Recommendation engine for e-commerce client,55000,Revenue
2024-06-30,Stark Industries,Cloud infrastructure and model serving costs,10000,Expenses
2024-06-30,Pinnacle Group,June retainer - PR and media outreach,7000,Revenue
2024-06-30,Pinnacle Group,PR distribution platform and media database,800,Expenses
2024-06-30,Nexon Digital,Custom checkout flow and upsell module,13000,Revenue
2024-06-30,Nexon Digital,Payment processing and app subscription fees,1100,Expenses`;

function downloadSampleCSV() {
  const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sample_data.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export default function UploadPage({ onUploadSuccess }) {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef();

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) validateAndSet(dropped);
  };

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
    setUploading(true);
    setError(null);
    setProgress(0);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post(`${API}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          setProgress(Math.round((e.loaded / e.total) * 100));
        },
      });
      onUploadSuccess({ ...res.data, file_format: res.data.file_format || 'standard' });
    } catch (err) {
      const msg = err.response?.data?.detail || 'Upload failed. Please try again.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setUploading(false);
    }
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
      {/* Header */}
      <div className="text-center mb-12 animate-fade-in">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: 'linear-gradient(135deg, #34d399, #22d3ee)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="font-display text-xl text-slate-300 tracking-wide">ProfitLens</span>
        </div>
        <h1 className="font-display text-5xl text-white mb-3" style={{ lineHeight: 1.15 }}>
          Client Profitability
          <br />
          <span className="gradient-text">Dashboard</span>
        </h1>
        <p className="text-slate-400 text-lg max-w-md mx-auto" style={{ fontFamily: 'DM Sans' }}>
          Upload your financial CSV or Excel file and instantly see profitability insights per client.
        </p>
      </div>

      {/* Upload Card */}
      <div className="glass-card w-full max-w-xl p-8 animate-slide-up">
        {/* Drop Zone */}
        <div
          className={`upload-zone rounded-xl p-12 text-center cursor-pointer ${dragging ? 'active' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => validateAndSet(e.target.files[0])}
          />

          {file ? (
            <div className="flex flex-col items-center gap-3">
              <div style={{
                width: 56, height: 56, borderRadius: 14,
                background: 'rgba(52, 211, 153, 0.15)',
                border: '1px solid rgba(52, 211, 153, 0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <polyline points="14 2 14 8 20 8" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="16" y1="13" x2="8" y2="13" stroke="#34d399" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="16" y1="17" x2="8" y2="17" stroke="#34d399" strokeWidth="2" strokeLinecap="round"/>
                  <polyline points="10 9 9 9 8 9" stroke="#34d399" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <p className="text-white font-medium text-base">{file.name}</p>
                <p className="text-slate-400 text-sm mt-1">{formatSize(file.size)}</p>
              </div>
              <button
                className="text-xs text-slate-500 hover:text-slate-300 underline mt-1"
                onClick={(e) => { e.stopPropagation(); setFile(null); }}
              >
                Change file
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div style={{
                width: 64, height: 64, borderRadius: 16,
                background: 'rgba(30, 41, 59, 0.8)',
                border: '1px solid #334155',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <polyline points="17 8 12 3 7 8" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="12" y1="3" x2="12" y2="15" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <p className="text-slate-300 font-medium">Drop your file here</p>
                <p className="text-slate-500 text-sm mt-1">or click to browse</p>
              </div>
              <div className="flex gap-2">
                {['.CSV', '.XLSX', '.XLS'].map((ext) => (
                  <span key={ext} className="px-2 py-1 rounded-md text-xs font-mono text-slate-400"
                    style={{ background: 'rgba(51, 65, 85, 0.5)', border: '1px solid #334155' }}>
                    {ext}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Progress bar */}
        {uploading && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-slate-400 mb-2">
              <span>Uploading...</span>
              <span>{progress}%</span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${progress}%`,
                  background: 'linear-gradient(90deg, #34d399, #22d3ee)',
                }}
              />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 px-4 py-3 rounded-lg text-sm text-rose-300"
            style={{ background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.2)' }}>
            ⚠ {error}
          </div>
        )}

        {/* Upload Button */}
        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="mt-6 w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-200"
          style={{
            background: file && !uploading
              ? 'linear-gradient(135deg, #34d399, #22d3ee)'
              : 'rgba(51, 65, 85, 0.5)',
            color: file && !uploading ? '#0a0f1e' : '#475569',
            cursor: file && !uploading ? 'pointer' : 'not-allowed',
            border: 'none',
            letterSpacing: '0.02em',
          }}
        >
          {uploading ? 'Processing...' : 'Analyze Data →'}
        </button>
      </div>

      {/* Required columns hint */}
      <div className="mt-8 text-center animate-fade-in stagger-2">
        <p className="text-slate-500 text-xs font-mono mb-3">REQUIRED COLUMNS</p>
        <div className="flex flex-wrap gap-2 justify-center">
          {['Date', 'Client Name', 'Description', 'Amount', 'Category'].map((col) => (
            <span key={col}
              className="px-3 py-1 rounded-full text-xs font-mono text-emerald-400"
              style={{ background: 'rgba(52, 211, 153, 0.08)', border: '1px solid rgba(52, 211, 153, 0.2)' }}>
              {col}
            </span>
          ))}
        </div>
        <p className="text-slate-600 text-xs mt-3">
          Category should contain "Revenue" or "Income" for revenue rows; anything else is treated as an expense.
          <br/>
          <span style={{ color: '#38bdf8' }}>QuickBooks</span> "Transaction List by Vendor" exports are automatically detected — the <strong>Split</strong> column is used as the category and vendors become clients.
        </p>

        {/* Sample download */}
        <div className="mt-6 flex flex-wrap gap-3 justify-center">
          <button
            onClick={downloadSampleCSV}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all hover:opacity-90"
            style={{
              background: 'rgba(52, 211, 153, 0.1)',
              border: '1px solid rgba(52, 211, 153, 0.3)',
              color: '#34d399',
              cursor: 'pointer',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="7 10 12 15 17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Download Sample CSV
          </button>
          <a
            href="data:text/plain;charset=utf-8,Date%2CClient%20Name%2CDescription%2CAmount%2CCategory%0A2024-01-05%2CAcme%20Corp%2CWebsite%20Design%2C15000%2CRevenue%0A2024-01-08%2CAcme%20Corp%2CServer%20Hosting%2C1200%2CExpenses"
            download="sample_template.csv"
            onClick={(e) => {
              e.preventDefault();
              const mini = `Date,Client Name,Description,Amount,Category\n2024-01-05,Your Client,Service Description,10000,Revenue\n2024-01-06,Your Client,Tool Cost,500,Expenses`;
              const blob = new Blob([mini], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = 'blank_template.csv'; a.click();
              URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all hover:opacity-90"
            style={{
              background: 'rgba(34, 211, 238, 0.08)',
              border: '1px solid rgba(34, 211, 238, 0.25)',
              color: '#22d3ee',
              cursor: 'pointer',
              textDecoration: 'none',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Blank Template
          </a>
        </div>
        <p className="text-slate-700 text-xs mt-3">Don't have a file yet? Download a sample to see the expected format.</p>
      </div>
    </div>
  );
}
