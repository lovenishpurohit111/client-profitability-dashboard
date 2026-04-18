import React from 'react';

export default function Sparkline({ data = [], color = '#34d399', width = 80, height = 32 }) {
  if (!data || data.length < 2) {
    return (
      <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#475569', fontSize: 10, fontFamily: 'JetBrains Mono' }}>—</span>
      </div>
    );
  }

  const min  = Math.min(...data);
  const max  = Math.max(...data);
  const range = max - min || 1;
  const pad  = 3;
  const w    = width;
  const h    = height;

  const points = data.map((val, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = h - pad - ((val - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  });

  const polyline = points.join(' ');

  // Area fill path
  const first = points[0].split(',');
  const last  = points[points.length - 1].split(',');
  const area  = `M ${first[0]},${h - pad} L ${polyline.replace(/(\d+\.?\d*),(\d+\.?\d*)/g, 'L $1,$2').slice(1)} L ${last[0]},${h - pad} Z`;

  const trend = data[data.length - 1] >= data[0];
  const lineColor = trend ? color : '#fb7185';
  const areaColor = trend ? 'rgba(52,211,153,0.1)' : 'rgba(251,113,133,0.1)';

  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`spark-grad-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lineColor} stopOpacity="0.3" />
          <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Area */}
      <path d={area} fill={`url(#spark-grad-${color.replace('#','')})`} />
      {/* Line */}
      <polyline
        points={polyline}
        fill="none"
        stroke={lineColor}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Last dot */}
      <circle
        cx={last[0]} cy={last[1]}
        r="2.5"
        fill={lineColor}
        stroke="#0f172a"
        strokeWidth="1"
      />
    </svg>
  );
}
