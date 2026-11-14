import { useState } from 'react';
import type { Metric } from '../services/types';
import { label } from '../services/api';
const regions = [
  { id: 'head', name: 'Head & eyes', y: 56, x: 100, metrics: ['facial'] },
  {
    id: 'heart',
    name: 'Cardiovascular',
    y: 126,
    x: 113,
    metrics: ['heart_rate', 'systolic', 'diastolic'],
  },
  { id: 'lungs', name: 'Respiratory', y: 114, x: 85, metrics: ['spo2'] },
  { id: 'body', name: 'Musculoskeletal', y: 231, x: 83, metrics: ['body_mass', 'activity'] },
  {
    id: 'wellbeing',
    name: 'General well-being',
    y: 179,
    x: 100,
    metrics: ['sleep_hours', 'sleep_quality', 'temperature'],
  },
];
export default function BodyMap({ metrics }: { metrics: Metric[] }) {
  const [selected, setSelected] = useState(regions[1]);
  return (
    <div className="body-map">
      <div className="body-graphic">
        <svg viewBox="0 0 200 320" aria-label="Interactive body regions">
          <defs>
            <linearGradient id="bodyFill">
              <stop stopColor="#1e4550" />
              <stop offset="1" stopColor="#11252f" />
            </linearGradient>
          </defs>
          <g stroke="#448792" strokeWidth="1" fill="url(#bodyFill)">
            <ellipse cx="100" cy="45" rx="22" ry="28" />
            <path d="M91 72 L109 72 L113 82 Q139 82 142 103 L156 175 Q157 188 146 191 Q138 191 136 181 L122 130 L120 185 L121 282 Q121 301 108 301 L101 207 L99 207 L92 301 Q79 301 79 282 L80 185 L78 130 L64 181 Q62 191 54 191 Q43 188 44 175 L58 103 Q61 82 87 82Z" />
          </g>
          <g stroke="#315560" strokeDasharray="3 4" fill="none">
            <path d="M100 83V204M78 112H122M80 175H120M84 250H116" />
          </g>
          {regions.map((r) => (
            <g
              key={r.id}
              role="button"
              tabIndex={0}
              aria-label={r.name}
              aria-pressed={selected.id === r.id}
              onClick={() => setSelected(r)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelected(r);
                }
              }}
              className="body-hotspot"
            >
              <circle
                cx={r.x}
                cy={r.y}
                r="14"
                fill={selected.id === r.id ? '#5fddc544' : '#173840'}
                stroke={selected.id === r.id ? '#72f9de' : '#407984'}
              />
              <circle cx={r.x} cy={r.y} r="4" fill={selected.id === r.id ? '#8dffe6' : '#59939c'} />
            </g>
          ))}
        </svg>
        <small>SELECT A REGION</small>
      </div>
      <div className="body-detail">
        <div className="body-tabs">
          {regions.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelected(r)}
              className={selected.id === r.id ? 'selected' : ''}
            >
              {r.name}
            </button>
          ))}
        </div>
        <h3>{selected.name}</h3>
        {metrics
          .filter((m) => selected.metrics.includes(m.metric))
          .map((m) => (
            <div className="body-metric" key={m.metric}>
              <span>{label(m.metric)}</span>
              <strong>
                {m.value} <small>{m.unit}</small>
              </strong>
            </div>
          ))}
        {selected.id === 'head' && (
          <p>
            Facial landmark observations appear below. Camera geometry cannot establish eye disease
            or other diagnoses.
          </p>
        )}
        <small>Simulated indicators · No anatomical diagnosis</small>
      </div>
    </div>
  );
}
