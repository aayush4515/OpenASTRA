import { useState } from 'react';
import { useCrew } from '../app';
import { useParams, Link } from 'react-router-dom';
import { ArrowRight, ScanLine } from 'lucide-react';
import { useApi, date, label } from '../services/api';
import type { Dashboard as Data } from '../services/types';
import {
  PageTitle,
  Panel,
  Badge,
  Loading,
  ErrorBox,
  Empty,
  MetricCard,
  Observations,
  TextLink,
} from '../components/UI';
import { TrendChart, FaceChart, VocChart } from '../components/Charts';
import BodyMap from '../features/BodyMap';
import BloodTest from '../features/BloodTest';
export default function Dashboard() {
  const { id } = useParams();
  const { select } = useCrew();
  const result = useApi<Data>(`/astronauts/${id}`, 15000);
  const [metric, setMetric] = useState('heart_rate');
  const [history, setHistory] = useState('');
  if (result.loading && !result.data) return <Loading />;
  if (result.error) return <ErrorBox message={result.error} retry={result.refresh} />;
  const d = result.data!;
  const c = d.checkins.find((c) => c.id === history) || d.checkins[0];
  const assessment = c?.result;
  const face = d.facial.filter((f) => f.source === 'live_camera' && f.valid);
  return (
    <>
      <PageTitle
        eyebrow={`${d.id} / PERSONAL HEALTH RECORD`}
        title={d.name}
        description={`${d.role} · ${d.mission} · ${d.synthetic ? 'Fictional demo profile' : 'Local profile'}`}
        action={
          <Link className="button primary" to="/booth" onClick={() => select(id!)}>
            <ScanLine size={17} />
            Start check-in
          </Link>
        }
      />
      <div className="dashboard-toolbar">
        <Badge tone="green">LOCAL RECORD</Badge>
        <span>Latest assessment {date(d.checkins[0]?.timestamp)}</span>
        <label>
          View assessment
          <select
            aria-label="Assessment history"
            value={history}
            onChange={(e) => setHistory(e.target.value)}
          >
            <option value="">Most recent</option>
            {d.checkins.map((c) => (
              <option key={c.id} value={c.id}>
                {date(c.timestamp)} · {new Date(c.timestamp).toLocaleTimeString()} · {c.scenario}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!c ? (
        <Empty>No assessments yet. Begin a check-in to build this astronaut’s history.</Empty>
      ) : (
        <>
          <div className="metrics-grid">
            {assessment.metrics
              ?.filter((m) =>
                ['heart_rate', 'spo2', 'temperature', 'sleep_hours'].includes(m.metric),
              )
              .map((m) => (
                <MetricCard metric={m} key={m.metric} />
              ))}
          </div>
          <div className="dashboard-grid">
            <Panel title="Your health, in context" kicker="CONNECTED INDICATORS">
              <BodyMap metrics={assessment.metrics || []} />
            </Panel>
            <Panel
              title="Personal trends"
              kicker="RECENT 35 READINGS"
              action={
                <select
                  aria-label="Trend metric"
                  value={metric}
                  onChange={(e) => setMetric(e.target.value)}
                >
                  {[
                    'heart_rate',
                    'sleep_hours',
                    'spo2',
                    'temperature',
                    'body_mass',
                    'activity',
                    'systolic',
                    'diastolic',
                  ].map((m) => (
                    <option key={m} value={m}>
                      {label(m)}
                    </option>
                  ))}
                </select>
              }
            >
              <div className="chart-legend">
                <span>
                  <i className="legend-line" /> Simulated readings
                </span>
                <span>
                  <i className="legend-line dashed" /> Personal reference
                </span>
              </div>
              <TrendChart
                readings={d.readings}
                metric={metric}
                baseline={d.baselines.find((b) => b.metric === metric)?.median}
              />
              <p className="fine-print">
                Same-context readings against an established personal reference. Selecting an
                earlier assessment changes the cards and observations; this chart always shows
                recent history.
              </p>
            </Panel>
          </div>
          <Panel
            title="What your assessment is telling you"
            kicker="OBSERVATIONS & NEXT STEPS"
            action={<TextLink to={`/intelligence/${id}`}>Explore the reasoning</TextLink>}
          >
            <Observations items={assessment.observations || []} compact />
          </Panel>
          <div className="dashboard-grid">
            <Panel title="Facial observation history" kicker="LIVE CAMERA / LANDMARK GEOMETRY">
              <Badge>{face.length} VALID LIVE CAPTURES</Badge>
              {face.length ? (
                <FaceChart
                  data={[...face]
                    .reverse()
                    .map((f) => ({
                      date: date(f.timestamp),
                      left: f.features.left_eye,
                      right: f.features.right_eye,
                    }))}
                />
              ) : (
                <Empty>
                  No live facial reference yet. Synthetic fixtures are excluded from this history.
                </Empty>
              )}
              <p className="fine-print">
                Left and right eyelid-opening ratios. At least three prior valid captures are needed
                for comparison. Pose and expression can change geometry.
              </p>
              {assessment.facial && <div className="next-step">{assessment.facial.message}</div>}
            </Panel>
            <Panel
              title="Chemical fingerprint"
              kicker="EXPERIMENTAL / SYNTHETIC E-NOSE"
              action={
                <Badge tone={assessment.voc?.status === 'review' ? 'amber' : 'neutral'}>
                  {label(assessment.voc?.status || 'no data')}
                </Badge>
              }
            >
              {assessment.voc?.channels.length ? (
                <VocChart channels={assessment.voc.channels} baseline={assessment.voc.baseline} />
              ) : (
                <Empty>No VOC readings in this assessment.</Empty>
              )}
              <p className="fine-print">
                Six relative-response channels compared with your reference. Environmental
                interference is possible. No hormone levels or identified molecules.
              </p>
            </Panel>
          </div>
        </>
      )}
      <BloodTest
        key={id}
        astronautId={id!}
        tests={d.blood_tests}
        reminder={d.reminder}
        onComplete={result.refresh}
      />
      <Panel title="Cabin context" kicker="ENVIRONMENTAL / SEPARATE FROM BODY MEASUREMENTS">
        <div className="environment-row">
          {assessment?.metrics
            ?.filter((m) => m.domain === 'environment')
            .map((m) => (
              <div key={m.metric}>
                <span>{label(m.metric)}</span>
                <strong>
                  {m.value} <small>{m.unit}</small>
                </strong>
                <Badge>SIMULATED CABIN SENSOR</Badge>
              </div>
            ))}
        </div>
      </Panel>
    </>
  );
}
