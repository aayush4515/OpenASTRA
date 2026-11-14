import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  LineChart,
  Line,
} from 'recharts';
import type { Reading } from '../services/types';
import { date } from '../services/api';
const tooltip = {
  background: '#12202d',
  border: '1px solid #34505d',
  borderRadius: 8,
  color: '#e4eef5',
  fontSize: 12,
};
export function TrendChart({
  readings,
  metric,
  baseline,
  color = '#63dfcb',
}: {
  readings: Reading[];
  metric: string;
  baseline?: number;
  color?: string;
}) {
  const data = readings
    .filter((r) => r.metric === metric)
    .slice(-35)
    .map((r) => ({ time: date(r.timestamp), value: r.value, unit: r.unit }));
  return (
    <div
      className="chart"
      role="img"
      aria-label={`${metric.replaceAll('_', ' ')} over ${data.length} readings`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: -18, right: 15, top: 10, bottom: 0 }}>
          <defs>
            <linearGradient id={'fill-' + metric} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.2} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#23313e" vertical={false} strokeDasharray="3 5" />
          <XAxis
            dataKey="time"
            tick={{ fill: '#8293a5', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            minTickGap={38}
          />
          <YAxis
            tick={{ fill: '#8293a5', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            domain={['auto', 'auto']}
          />
          <Tooltip contentStyle={tooltip} />
          {baseline !== undefined && (
            <ReferenceLine y={baseline} stroke="#83929e" strokeDasharray="4 5" />
          )}
          <Area
            isAnimationActive={false}
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#fill-${metric})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
export function VocChart({ channels, baseline }: { channels: number[]; baseline: number[] }) {
  const data = channels.map((v, i) => ({
    channel: `CH ${String(i + 1).padStart(2, '0')}`,
    current: v,
    reference: baseline[i],
  }));
  return (
    <div className="radar-chart" role="img" aria-label="Six-channel experimental VOC fingerprint">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data}>
          <PolarGrid stroke="#30424c" />
          <PolarAngleAxis dataKey="channel" tick={{ fill: '#94a6b7', fontSize: 10 }} />
          <Radar
            name="Reference"
            dataKey="reference"
            stroke="#7d8fa4"
            fill="#7d8fa4"
            fillOpacity={0.08}
          />
          <Radar
            name="Current"
            dataKey="current"
            stroke="#64dfce"
            fill="#64dfce"
            fillOpacity={0.2}
          />
          <Tooltip contentStyle={tooltip} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
export function FaceChart({ data }: { data: { date: string; left: number; right: number }[] }) {
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke="#23313e" />
          <XAxis dataKey="date" tick={{ fill: '#8293a5', fontSize: 10 }} />
          <YAxis domain={['auto', 'auto']} tick={{ fill: '#8293a5', fontSize: 10 }} />
          <Tooltip contentStyle={tooltip} />
          <Line isAnimationActive={false} dataKey="left" stroke="#64dfce" dot />
          <Line isAnimationActive={false} dataKey="right" stroke="#90b1ff" dot />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
