import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart
} from 'recharts';

const PrivacyUtilityChart = ({ data }) => {
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-bg-panel border border-border-panel p-3">
          <p className="text-sm font-mono text-accent-primary mb-2">ε = {label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-xs" style={{ color: entry.color }}>
              {entry.name}: {entry.value.toFixed(1)}%
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (!data || data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        No data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="privacyGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#00D1FF" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="#00D1FF" stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="utilityGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#B388FF" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="#B388FF" stopOpacity={0}/>
          </linearGradient>
        </defs>
        
        <CartesianGrid 
          strokeDasharray="3 3" 
          stroke="#1F2A44" 
          vertical={false}
        />
        
        <XAxis 
          dataKey="epsilon" 
          stroke="#627D98"
          tick={{ fill: '#627D98', fontSize: 12, fontFamily: 'JetBrains Mono' }}
          tickLine={{ stroke: '#1F2A44' }}
          axisLine={{ stroke: '#1F2A44' }}
          label={{ 
            value: 'Privacy Budget (ε)', 
            position: 'bottom', 
            offset: 0,
            fill: '#627D98',
            fontSize: 11,
            fontFamily: 'JetBrains Mono'
          }}
        />
        
        <YAxis 
          stroke="#627D98"
          tick={{ fill: '#627D98', fontSize: 12, fontFamily: 'JetBrains Mono' }}
          tickLine={{ stroke: '#1F2A44' }}
          axisLine={{ stroke: '#1F2A44' }}
          domain={[0, 100]}
          label={{ 
            value: 'Score (%)', 
            angle: -90, 
            position: 'insideLeft',
            fill: '#627D98',
            fontSize: 11,
            fontFamily: 'JetBrains Mono'
          }}
        />
        
        <Tooltip content={<CustomTooltip />} />
        
        <Area
          type="monotone"
          dataKey="privacy"
          name="Privacy"
          stroke="#00D1FF"
          strokeWidth={2}
          fill="url(#privacyGradient)"
          dot={{ fill: '#00D1FF', strokeWidth: 0, r: 4 }}
          activeDot={{ r: 6, stroke: '#00D1FF', strokeWidth: 2, fill: '#0A0F1C' }}
        />
        
        <Area
          type="monotone"
          dataKey="utility"
          name="Utility"
          stroke="#B388FF"
          strokeWidth={2}
          fill="url(#utilityGradient)"
          dot={{ fill: '#B388FF', strokeWidth: 0, r: 4 }}
          activeDot={{ r: 6, stroke: '#B388FF', strokeWidth: 2, fill: '#0A0F1C' }}
        />
        
        <ReferenceLine 
          x={1.0} 
          stroke="#00FFAA" 
          strokeDasharray="5 5"
          label={{ 
            value: 'Recommended ε=1.0', 
            fill: '#00FFAA', 
            fontSize: 10,
            position: 'top'
          }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
};

export default PrivacyUtilityChart;