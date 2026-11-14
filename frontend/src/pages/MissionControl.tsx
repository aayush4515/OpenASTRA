import { useState } from 'react';
import { Radio, Send, Check, WifiOff, ArrowRight, ShieldCheck } from 'lucide-react';
import { useCrew } from '../app';
import { api, useApi, date, time, label } from '../services/api';
import type { Queue, Message, Astronaut } from '../services/types';
import {
  PageTitle,
  Panel,
  Badge,
  ErrorBox,
  Avatar,
  Observations,
  Empty,
  Loading,
} from '../components/UI';
export default function MissionControl() {
  const { role, setRole } = useCrew();
  if (role !== 'mission_control')
    return (
      <>
        <PageTitle
          eyebrow="GROUND OPERATIONS / DEMO ACCESS"
          title="Mission Control."
          description="Select the ground role to review delivered reports and operate the communication simulator."
        />
        <Panel className="role-gate">
          <ShieldCheck size={42} />
          <h2>Switch to the ground team</h2>
          <p>
            This local role selector separates the two demonstration views. It is not authentication
            and must not be used to protect operational medical records.
          </p>
          <button className="button primary" onClick={() => setRole('mission_control')}>
            Enter Mission Control demo role
            <ArrowRight size={16} />
          </button>
        </Panel>
      </>
    );
  return <Ground />;
}
function Ground() {
  const { crew, selected, setRole } = useCrew();
  const queue = useApi<Queue>('/communications', 1500);
  const ground = useApi<{ crew: Astronaut[]; reports: Message[] }>('/mission-control', 1500);
  const [delay, setDelay] = useState<number>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<Message>();
  const [notice, setNotice] = useState('');
  async function mutate(path: string, method = 'POST', body?: unknown) {
    setBusy(true);
    setError('');
    try {
      await api(path, method, body);
      queue.refresh();
      ground.refresh();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  if (!queue.data)
    return queue.error ? <ErrorBox message={queue.error} retry={queue.refresh} /> : <Loading />;
  const q = queue.data;
  return (
    <>
      <PageTitle
        eyebrow="EARTH / FLIGHT SURGEON CONSOLE"
        title="Across the distance."
        description="Ground sees delivered reports. Onboard care continues through every outage."
        action={
          <button className="button secondary" onClick={() => setRole('astronaut')}>
            Return to astronaut role
          </button>
        }
      />
      {error && <ErrorBox message={error} />}{' '}
      {ground.error && <ErrorBox message={ground.error} retry={ground.refresh} />}
      <div className="ground-controls panel">
        <div className="connection-heading">
          {q.settings.link_online ? <Radio size={30} /> : <WifiOff size={30} />}
          <div>
            <h2>
              {q.settings.link_online ? 'Simulated link online' : 'Simulated communication outage'}
            </h2>
            <p>Persisted queue · {q.settings.delay_seconds}s one-way demonstration delay</p>
          </div>
        </div>
        <div className="ground-control-buttons">
          <button
            className={'button ' + (q.settings.link_online ? 'secondary' : 'primary')}
            disabled={busy}
            onClick={() =>
              mutate('/communications/settings', 'PUT', {
                link_online: !q.settings.link_online,
                delay_seconds: q.settings.delay_seconds,
              })
            }
          >
            {q.settings.link_online ? 'Disconnect Earth link' : 'Restore Earth link'}
          </button>
          <label>
            Delay (seconds)
            <input
              aria-label="Communication delay"
              type="number"
              min="0"
              max="3600"
              value={delay ?? q.settings.delay_seconds}
              onChange={(e) => setDelay(+e.target.value)}
            />
          </label>
          <button
            className="button secondary"
            disabled={busy || delay === undefined}
            onClick={async () => {
              if (
                await mutate('/communications/settings', 'PUT', {
                  link_online: q.settings.link_online,
                  delay_seconds: delay,
                })
              )
                setDelay(undefined);
            }}
          >
            Apply delay
          </button>
          <button
            className="button primary"
            disabled={busy}
            onClick={async () => {
              if (await mutate(`/communications/report/${selected}`))
                setNotice('Report queued from the selected astronaut’s latest assessment.');
            }}
          >
            <Send size={15} />
            Queue health report
          </button>
        </div>
        {notice && (
          <div className="saved-notice" role="status">
            {notice}
          </div>
        )}
      </div>
      <div className="ground-roster">
        {crew.map((c) => {
          const last = ground.data?.reports.find(
            (r) => r.astronaut_id === c.id && r.kind === 'health_report',
          );
          return (
            <div className="panel" key={c.id}>
              <Avatar name={c.name} color={c.color} />
              <h3>{c.name}</h3>
              <p>{c.role}</p>
              <Badge tone={last ? 'green' : 'neutral'}>
                {last ? 'REPORT RECEIVED' : 'AWAITING DOWNLINK'}
              </Badge>
              <p className="fine-print">
                {last
                  ? `Last ground report: ${date(last.created_at)} ${time(last.created_at)}`
                  : 'No delivered health report. Current onboard observations are not visible here.'}
              </p>
              {last && (
                <button className="text-link" onClick={() => setReport(last)}>
                  Review report
                  <ArrowRight size={14} />
                </button>
              )}
            </div>
          );
        })}
      </div>
      <Panel
        title="Communication queue"
        kicker="ONBOARD TRANSPORT SIMULATOR"
        action={<Badge>{q.messages.length} RECORDS</Badge>}
      >
        <p className="fine-print">
          Queue status is a demo transport view. Only delivered or acknowledged payloads can be
          opened in the ground console.
        </p>
        {!q.messages.length ? (
          <Empty>Prepare a health report or complete a check-in to populate the queue.</Empty>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Report</th>
                  <th>Crew member</th>
                  <th>Created</th>
                  <th>Delivery state</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {q.messages.map((m) => (
                  <tr key={m.id}>
                    <td>
                      {label(m.kind)}
                      <small className="block muted">{m.id.slice(0, 8)}</small>
                    </td>
                    <td>{crew.find((c) => c.id === m.astronaut_id)?.name}</td>
                    <td>
                      {date(m.created_at)} {time(m.created_at)}
                    </td>
                    <td>
                      <Badge
                        tone={
                          m.state === 'ACKNOWLEDGED'
                            ? 'green'
                            : m.state === 'QUEUED'
                              ? 'amber'
                              : 'neutral'
                        }
                      >
                        {label(m.state)}
                      </Badge>
                    </td>
                    <td>
                      <div className="button-row">
                        {['DELIVERED', 'ACKNOWLEDGED'].includes(m.state) && (
                          <button className="button quiet" onClick={() => setReport(m)}>
                            Open report
                          </button>
                        )}
                        {m.state === 'DELIVERED' && (
                          <button
                            disabled={busy}
                            className="button secondary"
                            onClick={() => mutate(`/communications/${m.id}/acknowledge`)}
                          >
                            <Check size={14} />
                            Acknowledge
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      {report && (
        <Panel
          title={label(report.kind)}
          kicker={`DELIVERED REPORT / ${report.id.slice(0, 8)}`}
          action={
            <button className="button quiet" onClick={() => setReport(undefined)}>
              Close report
            </button>
          }
        >
          {report.payload.assessment && (
            <>
              <Observations items={report.payload.assessment.observations} />
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Metric</th>
                      <th>Reading</th>
                      <th>Personal reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.payload.assessment.metrics.map((m) => (
                      <tr key={m.metric}>
                        <td>{label(m.metric)}</td>
                        <td>
                          {m.value} {m.unit}
                        </td>
                        <td>{m.baseline?.toFixed(2) ?? 'Unavailable'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {report.payload.event && (
            <div className="notice danger-notice">
              Emergency simulation: {report.payload.event}. Onboard crew escalation initiated.
            </div>
          )}
          {report.payload.results && (
            <div className="lab-table">
              {report.payload.results.map((r) => (
                <div className="lab-table-row" key={r.metric}>
                  <span>{label(r.metric)}</span>
                  <strong>
                    {r.value} {r.unit}
                  </strong>
                  <Badge>SIMULATED</Badge>
                </div>
              ))}
            </div>
          )}
          <div className="report-history">
            {q.messages
              .find((m) => m.id === report.id)
              ?.history.map((h, i) => (
                <span key={i}>
                  {label(h.state)} · {time(h.at)}
                </span>
              ))}
          </div>
        </Panel>
      )}
    </>
  );
}
