import React, { useState } from 'react';
import UploadPage from './components/UploadPage';
import Dashboard from './components/Dashboard';
import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  const [data,  setData]  = useState(null);
  const [error, setError] = useState(null);

  const handleUpload = (uploadData) => {
    try {
      setError(null);
      setData(uploadData);
    } catch(e) {
      setError(e.message);
    }
  };

  const handleReset = () => { setData(null); setError(null); };

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
        <ErrorBoundary onReset={handleReset}>
          {data
            ? <Dashboard data={data} onReset={handleReset} />
            : <UploadPage onUploadSuccess={handleUpload} uploadError={error} />}
        </ErrorBoundary>
      </div>
    </div>
  );
}
