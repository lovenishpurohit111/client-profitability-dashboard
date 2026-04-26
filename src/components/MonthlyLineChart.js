import React, { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine, ReferenceArea,
} from 'recharts';

const fmt = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0, notation: 'compact' }).format(n);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const isForecast = payload[0]?.payload?.is_forecast;
  return (
    <div style={{ background: '#0f172a', border: `1px solid ${isForecast ? 'rgba(168,139,250,0.4)' : '#334155'}`,
      borderRadius: 10, padding: '10px 14px', fontFamily: 'DM Sans', minWidth: 150 }}>
      <p style={{ color: isForecast ? '#c4b5fd' : '#64748b', fontSize: 11, fontFamily: 'JetBrains Mono', marginBottom: 8 }}>
        {label}{isForecast ? ' (forecast)' : ''}
      </p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4 mb-1">
          <span style={{ color: p.color, fontSize: 12 }}>{p.name}</span>
          <span style={{ color: p.color, fontSize: 13, fontFamily: 'JetBrains Mono', fontWeight: 700 }}>{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

export default function MonthlyLineChart({ trend = [], forecast = [] }) {
  const [showForecast, setShowForecast] = useState(true);

  const combined = [
    ...trend,
    ...(showForecast ? forecast : []),
  ];

  const firstForecastMonth = forecast.length > 0 ? forecast[0].month : null;

  if (!trend.length) return <div className="text-slate-500 text-sm text-center py-8">No trend data</div>;

  return (
    <div>
      {forecast.length > 0 && (
        <div className="flex justify-end mb-3">
          <button
            onClick={() => setShowForecast(f => !f)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px',
              borderRadius: 8, fontSize: 11, cursor: 'pointer', transition: 'all 0.2s',
              background: showForecast ? 'rgba(168,139,250,0.12)' : 'rgba(30,41,59,0.4)',
              border: `1px solid ${showForecast ? 'rgba(168,139,250,0.4)' : '#334155'}`,
              color: showForecast ? '#c4b5fd' : '#64748b', fontFamily: 'JetBrains Mono',
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: showForecast ? '#c4b5fd' : '#334155',
              display: 'inline-block' }} />
            {showForecast ? '3-Month Forecast On' : '3-Month Forecast Off'}
          </button>
        </div>
      )}

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={combined} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="revenueGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#22d3ee" />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'JetBrains Mono' }}
            axisLine={{ stroke: '#1e293b' }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={fmt}
            tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'JetBrains Mono' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: 16, fontFamily: 'DM Sans', fontSize: 12 }}
            formatter={(value) => <span style={{ color: '#94a3b8' }}>{value}</span>}
          />
          <ReferenceLine y={0} stroke="#334155" strokeDasharray="4 4" />

          {/* Forecast shading */}
          {showForecast && firstForecastMonth && (
            <ReferenceArea
              x1={firstForecastMonth}
              x2={combined[combined.length - 1]?.month}
              fill="rgba(168,139,250,0.05)"
              stroke="rgba(168,139,250,0.2)"
              strokeDasharray="4 4"
            />
          )}

          <Line type="monotone" dataKey="revenue"  name="Revenue"
            stroke="#34d399" strokeWidth={2.5}
            dot={(props) => {
              const { cx, cy, payload } = props;
              if (payload.is_forecast) return <circle key={props.key} cx={cx} cy={cy} r={3} fill="#c4b5fd" stroke="#0f172a" strokeWidth={1.5} />;
              return <circle key={props.key} cx={cx} cy={cy} r={4} fill="#34d399" strokeWidth={0} />;
            }}
            activeDot={{ r: 6, fill: '#34d399', stroke: '#0f172a', strokeWidth: 2 }}
          />
          <Line type="monotone" dataKey="expenses" name="Expenses"
            stroke="#fb7185" strokeWidth={2.5}
            dot={(props) => {
              const { cx, cy, payload } = props;
              if (payload.is_forecast) return <circle key={props.key} cx={cx} cy={cy} r={3} fill="#c4b5fd" stroke="#0f172a" strokeWidth={1.5} />;
              return <circle key={props.key} cx={cx} cy={cy} r={4} fill="#fb7185" strokeWidth={0} />;
            }}
            activeDot={{ r: 6, fill: '#fb7185', stroke: '#0f172a', strokeWidth: 2 }}
          />
          <Line type="monotone" dataKey="profit"   name="Profit"
            stroke="#22d3ee" strokeWidth={2.5} strokeDasharray="6 3"
            dot={(props) => {
              const { cx, cy, payload } = props;
              if (payload.is_forecast) return <circle key={props.key} cx={cx} cy={cy} r={3} fill="#c4b5fd" stroke="#0f172a" strokeWidth={1.5} />;
              return <circle key={props.key} cx={cx} cy={cy} r={4} fill="#22d3ee" strokeWidth={0} />;
            }}
            activeDot={{ r: 6, fill: '#22d3ee', stroke: '#0f172a', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>

      {showForecast && forecast.length > 0 && (
        <p className="text-xs text-center mt-2" style={{ color: '#4c1d95', fontFamily: 'JetBrains Mono' }}>
          <span style={{ color: '#7c3aed' }}>◈</span>{' '}
          <span style={{ color: '#a78bfa' }}>Shaded area = linear regression forecast (next 3 months)</span>
        </p>
      )}
    </div>
  );
}
