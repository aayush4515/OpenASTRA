import { useState } from 'react';
import { TriangleAlert, Radio, Users, Check, ShieldAlert } from 'lucide-react';
import { useCrew } from '../app';
import { api, useApi, date, time } from '../services/api';
import type { EmergencyEvent, Dashboard } from '../services/types';
import { PageTitle, Panel, Badge, ErrorBox, MetricCard } from '../components/UI';
const fallbackProtocol = [
  'Alert the other crew members and the crew medical officer immediately using the onboard alarm or voice channel.',
  'Follow the mission-approved onboard emergency procedures and the directions of the trained crew medical officer.',
  'Assign a crew member to record the event and prepare available observations. Do not wait for Earth communications.',
];
export default function Emergency() {
  const { selected, crew } = useCrew();
  const [event, setEvent] = useState('Chest pain and collapse');
  const [active, setActive] = useState<EmergencyEvent>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [activated, setActivated] = useState(false);
  const history = useApi<EmergencyEvent[]>('/emergencies', 5000);
  const patient = useApi<Dashboard>(`/astronauts/${selected}`);
  const person = crew.find((c) => c.id === selected);
  async function activate() {
    setActivated(true);
    setBusy(true);
    setError('');
    try {
      const e = await api<EmergencyEvent>('/emergencies', 'POST', {
        astronaut_id: selected,
        event,
      });
      setActive(e);
      history.refresh();
    } catch (e) {
      setError('Event has not been saved: ' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function resolve(e: EmergencyEvent) {
    try {
      await api(`/emergencies/${e.id}/resolve`, 'POST');
      if (active?.id === e.id) {
        setActive(undefined);
        setActivated(false);
      }
      history.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="IMMEDIATE ASSISTANCE / ONBOARD PRIORITY"
        title="Crew first. Earth next."
        description="Emergency assistance does not require a camera, an assessment, or a connection to Earth."
        action={<Badge tone="red">SIMULATION ONLY</Badge>}
      />
      <div className="emergency-layout">
        <Panel
          title="Activate emergency workflow"
          kicker="LOCAL CREW ESCALATION"
          className="emergency-panel"
        >
          <div className="emergency-symbol">
            <TriangleAlert size={44} />
          </div>
          <h2>{person?.name || 'Select crew in the header'}</h2>
          <p>
            For a real emergency, alert trained crew immediately and follow approved onboard
            procedures. This prototype cannot operate a physical alarm.
          </p>
          <label>
            Concerning event
            <select value={event} disabled={activated} onChange={(e) => setEvent(e.target.value)}>
              {[
                'Chest pain and collapse',
                'Severe breathing difficulty',
                'Injury',
                'Other urgent concern',
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <button
            className="button danger full"
            disabled={busy || !!active || !person}
            onClick={activate}
          >
            <ShieldAlert size={18} />
            {busy
              ? 'Recording event…'
              : active
                ? 'Emergency simulation active'
                : activated
                  ? 'Retry saving emergency event'
                  : 'Activate emergency simulation'}
          </button>
          {error && <ErrorBox message={error} />}{' '}
          {activated && (
            <div className="emergency-notified" role="alert">
              <Users size={23} />
              <div>
                <strong>On-screen crew notification active</strong>
                <p>
                  {active
                    ? 'Event saved locally. Mission Control report queued.'
                    : 'Alert crew directly now. The on-screen workflow is active; local persistence is not yet confirmed.'}
                </p>
              </div>
            </div>
          )}
          <div className="emergency-facts">
            <span>
              <Radio size={15} />
              No Earth response required to begin
            </span>
            <span>
              <Users size={15} />
              Follow trained crew leadership
            </span>
          </div>
        </Panel>
        <div>
          <Panel title="Immediate priorities" kicker="PREDEFINED DEMONSTRATION CONTENT">
            <ol className="protocol">
              {(active?.protocol || fallbackProtocol).map((p, i) => (
                <li key={p}>
                  <span>{String(i + 1).padStart(2, '0')}</span>
                  <p>{p}</p>
                </li>
              ))}
            </ol>
            <p className="fine-print">
              No medication doses, invasive procedures or diagnostic instructions are provided. This
              is an unvalidated decision-support demonstration.
            </p>
          </Panel>
          <Panel title="Available patient context" kicker="RECENT SIMULATED MEASUREMENTS">
            <div className="metrics-grid small">
              {patient.data?.checkins[0]?.result.metrics
                ?.filter((m) => ['heart_rate', 'spo2'].includes(m.metric))
                .map((m) => (
                  <MetricCard key={m.metric} metric={m} />
                ))}
            </div>
            <p className="fine-print">
              Measurements may be old or simulated. They must not delay or determine emergency
              response.
            </p>
          </Panel>
        </div>
      </div>
      <Panel title="Local event log" kicker="PERSISTED EMERGENCY RECORDS">
        {history.error && <ErrorBox message={history.error} retry={history.refresh} />}{' '}
        {!history.data?.length && <p className="muted">No emergency events recorded.</p>}
        {history.data?.map((e) => (
          <div className="event-row" key={e.id}>
            <TriangleAlert size={20} />
            <div>
              <h3>{e.event}</h3>
              <p>
                {crew.find((c) => c.id === e.astronaut_id)?.name} · {date(e.timestamp)}{' '}
                {time(e.timestamp)}
              </p>
            </div>
            <Badge tone={e.resolved ? 'green' : 'red'}>
              {e.resolved ? 'SIMULATION CLOSED' : 'CREW NOTIFIED · SIMULATED'}
            </Badge>
            {!e.resolved && (
              <button className="button secondary" onClick={() => resolve(e)}>
                <Check size={15} />
                Close simulation
              </button>
            )}
          </div>
        ))}
      </Panel>
    </>
  );
}
