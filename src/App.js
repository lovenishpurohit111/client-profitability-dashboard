import React, { useState } from 'react';
import UploadPage from './components/UploadPage';
import AppNav from './components/AppNav';
import Dashboard from './components/Dashboard';

export default function App() {
  const [page, setPage] = useState('upload');
  const [uploadMeta, setUploadMeta] = useState(null);

  const handleUploadSuccess = (meta) => {
    setUploadMeta(meta);
    setPage('dashboard');
  };

  const handleReset = () => {
    setUploadMeta(null);
    setPage('upload');
  };

  return (
    <div className="noise-bg min-h-screen" style={{ background: 'linear-gradient(135deg, #0a0f1e 0%, #0d1b2e 50%, #0a1628 100%)' }}>
      {/* Ambient glow blobs */}
      <div
        style={{
          position: 'fixed', top: '-20%', right: '-10%',
          width: '600px', height: '600px',
          background: 'radial-gradient(circle, rgba(52,211,153,0.06) 0%, transparent 70%)',
          pointerEvents: 'none', zIndex: 0,
        }}
      />
      <div
        style={{
          position: 'fixed', bottom: '-20%', left: '-10%',
          width: '500px', height: '500px',
          background: 'radial-gradient(circle, rgba(34,211,238,0.05) 0%, transparent 70%)',
          pointerEvents: 'none', zIndex: 0,
        }}
      />
      <AppNav currentApp="cpd" />
      <div className="content-layer">
        {page === 'upload' ? (
          <UploadPage onUploadSuccess={handleUploadSuccess} />
        ) : (
          <Dashboard meta={uploadMeta} onReset={handleReset} />
        )}
      </div>
    </div>
  );
}
