import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }
  componentDidCatch(error, info) {
    this.setState({ error, info });
    console.error('App crash:', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
          background:'#0a0f1e', padding:40 }}>
          <div style={{ maxWidth:600, width:'100%', background:'rgba(251,113,133,0.08)',
            border:'1px solid rgba(251,113,133,0.3)', borderRadius:16, padding:32 }}>
            <h2 style={{ color:'#fb7185', fontFamily:'DM Serif Display', fontSize:'1.4rem', marginBottom:12 }}>
              Something went wrong
            </h2>
            <pre style={{ color:'#94a3b8', fontSize:12, fontFamily:'JetBrains Mono',
              whiteSpace:'pre-wrap', wordBreak:'break-all', marginBottom:20 }}>
              {this.state.error?.message}
            </pre>
            <button onClick={() => { this.setState({ error:null, info:null }); this.props.onReset?.(); }}
              style={{ padding:'10px 24px', borderRadius:8, fontSize:13, fontWeight:600,
                background:'rgba(56,189,248,0.15)', border:'1px solid rgba(56,189,248,0.4)',
                color:'#38bdf8', cursor:'pointer' }}>
              ← Start Over
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
