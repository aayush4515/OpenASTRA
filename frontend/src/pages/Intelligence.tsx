import { useParams } from 'react-router-dom';
import { BrainCircuit } from 'lucide-react';
import { useApi, label } from '../services/api';
import type { Assessment } from '../services/types';
import {
  PageTitle,
  Panel,
  Loading,
  ErrorBox,
  Observations,
  Badge,
  Empty,
  TextLink,
} from '../components/UI';
export default function Intelligence() {
  const { id } = useParams();
  const r = useApi<Assessment>(`/health-analysis/${id}`);
  if (r.loading) return <Loading />;
  if (r.error) return <ErrorBox message={r.error} retry={r.refresh} />;
  const a = r.data!;
  return (
    <>
      <PageTitle
        eyebrow="PERSONAL HEALTH INTELLIGENCE"
        title="Understand the change."
        description="Individual references. Explainable observations. Clear next steps."
        action={<TextLink to={`/astronaut/${id}`}>Back to health record</TextLink>}
      />
      <div className="intelligence-intro">
        <BrainCircuit size={30} />
        <div>
          <h2>Patterns for investigation, not diagnoses.</h2>
          <p>{a.baseline_policy || 'No personal reference is available yet.'}</p>
        </div>
      </div>
      {a.missing_baselines?.length > 0 && (
        <div className="notice">
          Insufficient comparable history for: {a.missing_baselines.map(label).join(', ')}. No
          baseline conclusion is made for these metrics.
        </div>
      )}
      {a.missing_data?.length ? (
        <div className="notice">
          Missing measurements: {a.missing_data.join(', ')}. A skipped measurement is not a
          reassuring result.
        </div>
      ) : null}
      <Panel title="Assessment reasoning" kicker="MEASUREMENTS → CONTEXT → ACTION">
        {a.observations.length ? (
          <Observations items={a.observations} />
        ) : (
          <Empty>Complete a check-in to see an assessment.</Empty>
        )}
      </Panel>
      <Panel title="Personal reference comparison" kicker="REPRODUCIBLE STATISTICS">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Metric</th>
                <th>Current</th>
                <th>Reference median</th>
                <th>Robust deviation</th>
                <th>Recent slope / reading</th>
                <th>Reference samples</th>
              </tr>
            </thead>
            <tbody>
              {a.metrics?.map((m) => (
                <tr key={m.metric}>
                  <td>
                    {label(m.metric)}
                    <small className="block muted">{m.source}</small>
                  </td>
                  <td>
                    {m.value} {m.unit}
                  </td>
                  <td>{m.baseline?.toFixed(2) ?? 'Unavailable'}</td>
                  <td>
                    <Badge tone={m.score !== null && m.score >= 3 ? 'amber' : 'neutral'}>
                      {m.score?.toFixed(2) ?? '—'}
                    </Badge>
                  </td>
                  <td>{m.trend}</td>
                  <td>{m.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      {a.facial?.changes.length ? (
        <Panel
          title="Facial comparison"
          kicker={
            a.facial.source === 'synthetic_fixture'
              ? 'SYNTHETIC FIXTURE / NOT LIVE CAMERA'
              : 'LIVE CAMERA / PERSONAL REFERENCE'
          }
        >
          <p>{a.facial.message}</p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Current ratio</th>
                  <th>Reference</th>
                  <th>Deviation</th>
                </tr>
              </thead>
              <tbody>
                {a.facial.changes.map((f) => (
                  <tr key={f.metric}>
                    <td>{label(f.metric)}</td>
                    <td>{f.value.toFixed(3)}</td>
                    <td>{f.baseline.toFixed(3)}</td>
                    <td>
                      <Badge tone={f.flagged ? 'amber' : 'neutral'}>{f.score}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}
      <Panel title="Research context & limits" kicker="TRACEABLE FOUNDATION">
        <p>
          The mission risk context follows NASA’s Human Research Program: isolation, distance from
          Earth, gravity changes, radiation, and closed environments. ASTRA’s statistics and
          guidance are demonstration rules, not published NASA medical thresholds.
        </p>
        <div className="reference-links">
          <a href="https://www.nasa.gov/hrp/hazards/" target="_blank" rel="noreferrer">
            NASA · Five hazards of human spaceflight ↗
          </a>
          <a href="https://www.nasa.gov/hrp/risks/" target="_blank" rel="noreferrer">
            NASA · Human spaceflight risks ↗
          </a>
          <a
            href="https://www.nasa.gov/ames/space-biosciences/bioengineering-branch/e-nose/"
            target="_blank"
            rel="noreferrer"
          >
            NASA · E-nose research ↗
          </a>
        </div>
        <p className="fine-print">
          References need internet to open. Core analysis does not. The skin VOC simulation is an
          independent research concept; NASA’s breath-sensing research does not validate this
          implementation. Guidance has not undergone clinical review.
        </p>
      </Panel>
    </>
  );
}
