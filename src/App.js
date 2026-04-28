import React, { useState } from 'react';
import UploadPage from './components/UploadPage';
import Dashboard from './components/Dashboard';

export default function App() {
  const [page, setPage]       = useState('upload');
  const [meta, setMeta]       = useState(null);

  const handleUploadSuccess = (m) => { setMeta(m); setPage('dashboard'); };
  const handleReset         = () => { setMeta(null); setPage('upload'); };

  return (
    <div className="noise-bg min-h-screen"
      style={{ background:'linear-gradient(135deg,#0a0f1e 0%,#0d1b2e 50%,#0a1628 100%)' }}>
      <div style={{ position:'fixed',top:'-20%',right:'-10%',width:600,height:600,
        background:'radial-gradient(circle,rgba(56,189,248,0.05) 0%,transparent 70%)',
        pointerEvents:'none',zIndex:0 }}/>
      <div style={{ position:'fixed',bottom:'-20%',left:'-10%',width:500,height:500,
        background:'radial-gradient(circle,rgba(129,140,248,0.04) 0%,transparent 70%)',
        pointerEvents:'none',zIndex:0 }}/>
      <div className="content-layer">
        {page === 'upload'
          ? <UploadPage onUploadSuccess={handleUploadSuccess}/>
          : <Dashboard meta={meta} onReset={handleReset}/>}
      </div>
    </div>
  );
}
