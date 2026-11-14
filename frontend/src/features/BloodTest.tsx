import { useState } from 'react';
import { FlaskConical, Check, ArrowRight } from 'lucide-react';
import { api, date, label } from '../services/api';
import type { Lab, Reminder } from '../services/types';
import { Panel, Badge, ErrorBox } from '../components/UI';
import Station from './Station';
export default function BloodTest({
  astronautId,
  tests,
  reminder,
  onComplete,
}: {
  astronautId: string;
  tests: Lab[];
  reminder: Reminder;
  onComplete: () => void;
}) {
  const [lab, setLab] = useState<Lab | undefined>(tests.find((t) => t.state !== 'COMPLETED'));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const completed = tests.filter((t) => t.state === 'COMPLETED');
  const latest = completed[0],
    previous = completed[1];
  async function advance() {
    setBusy(true);
    setError('');
    try {
      const result =
        lab && lab.state !== 'COMPLETED'
          ? await api<Lab>(`/blood-tests/${lab.id}/advance`, 'POST', { expected_state: lab.state })
          : await api<Lab>(`/blood-tests/${astronautId}`, 'POST');
      setLab(result);
      if (result.state === 'COMPLETED') onComplete();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel
      title="Weekly laboratory"
      kicker="PORTABLE ANALYZER / SIMULATED"
      action={
        <Badge tone={reminder?.status === 'overdue' ? 'amber' : 'green'}>
          {reminder?.status === 'overdue' ? 'DUE FOR COLLECTION' : `NEXT ${date(reminder?.due_at)}`}
        </Badge>
      }
    >
      <p className="muted">
        A small illustrative panel. No biological sample is collected or analyzed. This schedule is
        configurable and is not a NASA protocol.
      </p>
      {error && <ErrorBox message={error} />}
      <div className="lab-table">
        <div className="lab-table-head">
          <span>INDICATOR</span>
          <span>LATEST</span>
          <span>PREVIOUS</span>
        </div>
        {latest?.results.map((r) => (
          <div className="lab-table-row" key={r.metric}>
            <span>{label(r.metric)}</span>
            <strong>
              {r.value} <small>{r.unit}</small>
            </strong>
            <span>{previous?.results.find((p) => p.metric === r.metric)?.value ?? '—'}</span>
          </div>
        ))}
      </div>
      <div className="lab-meta">
        <span>Last completed {date(reminder?.last_completed)}</span>
        <span>{completed.length} results in history</span>
      </div>
      {lab && lab.state !== 'COMPLETED' && (
        <div className="lab-workflow">
          <div className="lab-mini-station">
            <Station active={lab.state === 'ANALYZING' ? 'blood' : ''} compact selected="blood" />
          </div>
          <div className="lab-instruction">
            <Badge tone="amber">{label(lab.state)}</Badge>
            <h3>
              {lab.state === 'PREPARED'
                ? 'Prepare a simulated sample'
                : lab.state === 'SAMPLE_LOADED'
                  ? 'Sample loaded into the analyzer'
                  : 'Analyzer ready to report'}
            </h3>
            <p>
              {lab.state === 'PREPARED'
                ? 'For this demonstration, select Load simulated sample. In actual operations, only trained crew would use approved collection procedures. No needle or automated extraction is simulated.'
                : lab.state === 'SAMPLE_LOADED'
                  ? 'Begin the local analysis simulation. The portable analyzer will generate the three illustrative values.'
                  : 'Save the simulated result, queue the lab report, and schedule the next reminder.'}
            </p>
          </div>
        </div>
      )}
      {lab?.state === 'COMPLETED' && (
        <div className="saved-notice">
          <Check size={16} />
          Lab results saved. Next reminder scheduled.
        </div>
      )}
      <button className="button secondary" onClick={advance} disabled={busy}>
        <FlaskConical size={16} />
        {busy
          ? 'Updating analyzer…'
          : !lab || lab.state === 'COMPLETED'
            ? 'Start simulated blood test'
            : lab.state === 'PREPARED'
              ? 'Load simulated sample'
              : lab.state === 'SAMPLE_LOADED'
                ? 'Run simulated analysis'
                : 'Save lab results'}
        <ArrowRight size={16} />
      </button>
      {completed.length > 1 && (
        <details className="history-details">
          <summary>View laboratory history</summary>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Hemoglobin</th>
                  <th>Glucose</th>
                  <th>White cells</th>
                </tr>
              </thead>
              <tbody>
                {completed.map((t) => (
                  <tr key={t.id}>
                    <td>{date(t.timestamp)}</td>
                    {t.results.map((r) => (
                      <td key={r.metric}>
                        {r.value} {r.unit}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </Panel>
  );
}
