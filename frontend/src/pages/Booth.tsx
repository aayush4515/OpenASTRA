import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ScanLine, ArrowRight, Check, RotateCcw, ShieldCheck, Activity } from 'lucide-react';
import { useCrew } from '../app';
import { api, label } from '../services/api';
import type { Checkin, Answers, FacialCapture } from '../services/types';
import { PageTitle, Panel, Badge, ErrorBox, Observations } from '../components/UI';
import Station, { equipment } from '../features/Station';
import Camera from '../features/Camera';
import Questionnaire from '../features/Questionnaire';
const steps = [
  'Identity',
  'Facial scan',
  'Vitals & wearable',
  'VOC fingerprint',
  'Conversation',
  'Assessment',
];
const stageIndex: Record<string, number> = {
  IDENTIFYING: 0,
  IDENTITY_CONFIRMED: 0,
  FACIAL_SCAN: 1,
  SENSOR_COLLECTION: 2,
  VOC_SCAN: 3,
  QUESTIONNAIRE: 4,
  PROCESSING: 5,
  RESULTS_READY: 6,
  COMPLETED: 6,
};
const activeModule: Record<string, string> = {
  IDENTIFYING: 'camera',
  FACIAL_SCAN: 'camera',
  SENSOR_COLLECTION: 'sensors',
  VOC_SCAN: 'voc',
};
export default function Booth() {
  const { crew, selected, refresh } = useCrew();
  const [scenario, setScenario] = useState('normal');
  const [session, setSession] = useState<Checkin>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [device, setDevice] = useState('camera');
  const [adjust, setAdjust] = useState(false);
  const [pulse, setPulse] = useState(78);
  const [sleep, setSleep] = useState(7.5);
  useEffect(() => {
    const id = sessionStorage.getItem('astra-checkin');
    if (id)
      api<Checkin>('/checkins/' + id)
        .then((c) => {
          if (!['CANCELLED', 'COMPLETED'].includes(c.state)) setSession(c);
          else sessionStorage.removeItem('astra-checkin');
        })
        .catch(() => sessionStorage.removeItem('astra-checkin'));
  }, []);
  const person = crew.find((c) => c.id === (session?.astronaut_id || selected));
  const index = session ? stageIndex[session.state] : -1;
  async function start() {
    setBusy(true);
    setError('');
    try {
      const c = await api<Checkin>('/checkins', 'POST', { astronaut_id: selected, scenario });
      setSession(c);
      sessionStorage.setItem('astra-checkin', c.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function next(extra: Record<string, unknown> = {}) {
    if (!session) return;
    setBusy(true);
    setError('');
    try {
      const c = await api<Checkin>(`/checkins/${session.id}/advance`, 'POST', {
        expected_state: session.state,
        ...extra,
      });
      setSession(c);
      if (c.state === 'COMPLETED') {
        sessionStorage.removeItem('astra-checkin');
        refresh();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function cancel() {
    if (!session) return;
    setBusy(true);
    try {
      await api(`/checkins/${session.id}/cancel`, 'POST');
      sessionStorage.removeItem('astra-checkin');
      setSession(undefined);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const selectedEquipment = equipment.find((e) => e.id === device)!;
  return (
    <>
      <PageTitle
        eyebrow="MEDICAL STATION 01 / ONBOARD ASSESSMENT"
        title="A moment for your health."
        description="One connected workflow. Every observation, in context."
        action={<Badge tone="green">{session ? label(session.state) : 'STATION READY'}</Badge>}
      />
      <div
        className="checkin-progress-track"
        role="progressbar"
        aria-label="Check-in progress"
        aria-valuemin={0}
        aria-valuemax={6}
        aria-valuenow={Math.max(0, index)}
      >
        <motion.div
          className="checkin-progress"
          initial={false}
          animate={{ scaleX: Math.max(0, index) / 6 }}
          transition={{
            duration:
              typeof matchMedia === 'function' &&
              matchMedia('(prefers-reduced-motion: reduce)').matches
                ? 0
                : 0.3,
          }}
        />
      </div>
      <div className="checkin-steps">
        {steps.map((s, i) => (
          <div key={s} className={i === index ? 'current' : i < index ? 'done' : ''}>
            <span>{i < index ? <Check size={12} /> : String(i + 1).padStart(2, '0')}</span>
            {s}
          </div>
        ))}
      </div>
      <div className="booth-layout">
        <div className="booth-left">
          <section className="panel booth-visual">
            <div className="booth-overlay">
              <span className="eyebrow">ASTRA / INTEGRATED HEALTH STATION</span>
              <Badge tone="green">{busy ? 'COLLECTING' : 'LOCAL SYSTEM'}</Badge>
            </div>
            <Station
              active={session ? activeModule[session.state] || '' : ''}
              selected={device}
              onSelect={setDevice}
            />
            <div className="booth-bottom">
              <span>DRAG TO ORBIT · SCROLL TO ZOOM</span>
              <span>PROCEDURAL 3D / LIVE STATE</span>
            </div>
          </section>
          <div className="equipment-buttons" aria-label="Station equipment">
            {equipment.map((e) => (
              <button
                className={device === e.id ? 'selected' : ''}
                onClick={() => setDevice(e.id)}
                key={e.id}
              >
                {e.name}
              </button>
            ))}
          </div>
          <Panel className="equipment-description">
            <div>
              <ScanLine size={22} />
              <h3>{selectedEquipment.name}</h3>
            </div>
            <p>{selectedEquipment.detail}</p>
          </Panel>
        </div>
        <Panel
          title={
            index === 6
              ? 'Assessment saved'
              : session
                ? steps[Math.min(index, 5)]
                : 'Prepare for assessment'
          }
          kicker={session ? `CHECK-IN / ${person?.name.toUpperCase()}` : 'READY WHEN YOU ARE'}
          className="checkin-panel"
        >
          {error && <ErrorBox message={error} />}{' '}
          {!session && (
            <>
              <p>
                Confirm your profile, use the local camera, collect simulated readings and share how
                you feel.
              </p>
              <div className="selected-profile">
                <ShieldCheck />
                <div>
                  <strong>{person?.name || 'Select a crew member'}</strong>
                  <span>{person?.role}</span>
                </div>
              </div>
              <label>
                Demonstration scenario
                <select value={scenario} onChange={(e) => setScenario(e.target.value)}>
                  <option value="normal">A · Routine assessment</option>
                  <option value="gradual">B · Rest & recovery change</option>
                  <option value="facial_change">C · Facial geometry fixture + live camera</option>
                  <option value="voc_anomaly">D · Experimental VOC change</option>
                  <option value="sensor_fault">Sensor unavailable / retry demo</option>
                </select>
              </label>
              <label className="consent">
                <input
                  type="checkbox"
                  checked={adjust}
                  onChange={(e) => setAdjust(e.target.checked)}
                />{' '}
                Adjust simulated sensor outputs
              </label>
              {adjust && (
                <div className="two-fields">
                  <label>
                    Resting pulse (bpm)
                    <input
                      type="number"
                      min="25"
                      max="240"
                      value={pulse}
                      onChange={(e) => setPulse(+e.target.value)}
                    />
                  </label>
                  <label>
                    Sleep (h)
                    <input
                      type="number"
                      min="0"
                      max="24"
                      step=".1"
                      value={sleep}
                      onChange={(e) => setSleep(+e.target.value)}
                    />
                  </label>
                </div>
              )}
              <button className="button primary full" disabled={busy || !person} onClick={start}>
                <ScanLine size={17} />
                Begin check-in
                <ArrowRight size={16} />
              </button>
              <p className="fine-print">
                About 3 minutes. No internet or microphone required. You can skip the camera and
                cancel before saving.
              </p>
            </>
          )}
          {session?.state === 'IDENTIFYING' && (
            <>
              <div className="identity-orbit">
                <ScanLine size={40} />
              </div>
              <h3>Confirm your identity</h3>
              <p>
                This station uses manual identity confirmation. Face detection alone does not
                establish who you are.
              </p>
              <div className="selected-profile">
                <ShieldCheck />
                <div>
                  <strong>{person?.name}</strong>
                  <span>
                    {person?.id} ·{' '}
                    {person?.enrolled
                      ? 'Local facial reference enrolled'
                      : 'No live facial reference enrolled'}
                  </span>
                </div>
              </div>
              <button
                className="button primary full"
                disabled={busy}
                onClick={() => next({ identity_confirmed: true })}
              >
                Confirm {person?.name}
                <ArrowRight size={16} />
              </button>
            </>
          )}
          {session?.state === 'IDENTITY_CONFIRMED' && (
            <>
              <div className="identity-orbit">
                <Check size={40} />
              </div>
              <h3>Identity confirmed</h3>
              <p>
                Your personal history is available. Next, the optical module can measure facial
                landmarks from your webcam.
              </p>
              <button className="button primary full" disabled={busy} onClick={() => next()}>
                Open optical assessment
                <ArrowRight size={16} />
              </button>
            </>
          )}
          {session?.state === 'FACIAL_SCAN' && (
            <>
              <Camera
                onCapture={(facial: FacialCapture) => next({ facial })}
                onSkip={() => next({ skip: true })}
              />
              {session.scenario === 'facial_change' && (
                <div className="fixture-box">
                  <Badge tone="amber">SYNTHETIC CAMERA FIXTURE</Badge>
                  <p>
                    Exercise the geometric-change comparison with an explicitly synthetic sample. It
                    is isolated from real camera history.
                  </p>
                  <button
                    className="button secondary full"
                    disabled={busy}
                    onClick={() =>
                      next({
                        facial: {
                          features: {
                            left_eye: 0.15,
                            right_eye: 0.3,
                            mouth_tilt: 0.01,
                            brow_height: 0.17,
                            asymmetry: 0.02,
                          },
                          quality: {
                            brightness: 120,
                            yaw: 0,
                            roll: 0,
                            face_size: 0.4,
                            stability: 0.005,
                            frames: 10,
                          },
                          source: 'synthetic_fixture',
                          consent: true,
                        },
                      })
                    }
                  >
                    Use labeled facial-change fixture
                  </button>
                </div>
              )}
            </>
          )}
          {session?.state === 'SENSOR_COLLECTION' && (
            <>
              <div className={'identity-orbit ' + (busy ? 'collecting' : '')}>
                <Activity size={40} />
              </div>
              <h3>Connect to the station</h3>
              <p>
                Wearable, vitals, thermal, inertial mass and cabin adapters will return validated,
                timestamped measurements.
              </p>
              <div className="sensor-list">
                {[
                  'Resting pulse & sleep',
                  'Blood pressure & oxygen',
                  'Temperature & body mass',
                  'Cabin environment',
                ].map((s) => (
                  <div key={s}>
                    <span className="status-dot" />
                    {s}
                    <Badge>SIMULATED</Badge>
                  </div>
                ))}
              </div>
              <button
                className="button primary full"
                disabled={busy}
                onClick={() =>
                  next({ overrides: adjust ? { heart_rate: pulse, sleep_hours: sleep } : {} })
                }
              >
                {busy ? 'Collecting validated readings…' : 'Collect simulated readings'}
                <ArrowRight size={16} />
              </button>
              {error && (
                <>
                  <button className="button secondary full" onClick={() => next({ skip: true })}>
                    Skip unavailable devices
                  </button>
                  <p className="fine-print">
                    A retry uses the same scenario. To restore the faulty simulated wearable, cancel
                    and select a working scenario.
                  </p>
                </>
              )}
            </>
          )}
          {session?.state === 'VOC_SCAN' && (
            <>
              <div className="voc-bars">
                {[40, 70, 53, 35, 85, 48].map((v, i) => (
                  <i key={i} style={{ height: v + '%' }} />
                ))}
              </div>
              <h3>Your chemical fingerprint</h3>
              <p>
                The experimental e-nose compares six synthetic response channels with your
                individual history. It cannot measure hormones.
              </p>
              <Badge tone="amber">EXPERIMENTAL · SIMULATED</Badge>
              <button className="button primary full" disabled={busy} onClick={() => next()}>
                {busy ? 'Collecting…' : 'Collect VOC fingerprint'}
                <ArrowRight size={16} />
              </button>
            </>
          )}
          {session?.state === 'QUESTIONNAIRE' && (
            <Questionnaire
              checkinId={session.id}
              onSubmit={(answers: Answers) => next({ answers })}
              busy={busy}
            />
          )}
          {session?.state === 'PROCESSING' && (
            <>
              <div className="identity-orbit">
                <Activity size={40} />
              </div>
              <h3>Ready for personal analysis</h3>
              <p>
                Compare this assessment with your stored reference. Measurements, responses,
                observations and a Mission Control report will be saved together.
              </p>
              <button className="button primary full" disabled={busy} onClick={() => next()}>
                {busy ? 'Analyzing and saving…' : 'Analyze & save assessment'}
                <ArrowRight size={16} />
              </button>
            </>
          )}
          {session && ['RESULTS_READY', 'COMPLETED'].includes(session.state) && (
            <>
              <div className="saved-notice">
                <Check size={18} />
                Saved to local SQLite. Report queued for Earth.
              </div>
              <Observations items={session.result.observations} compact />
              {session.result.facial && (
                <p className="fine-print">Facial assessment: {session.result.facial.message}</p>
              )}
              {session.state === 'RESULTS_READY' ? (
                <button className="button primary full" onClick={() => next()} disabled={busy}>
                  Finish check-in
                  <Check size={16} />
                </button>
              ) : (
                <Link className="button primary full" to={`/astronaut/${session.astronaut_id}`}>
                  View health dashboard
                  <ArrowRight size={16} />
                </Link>
              )}
              <button
                className="button quiet full"
                onClick={() => {
                  setSession(undefined);
                  sessionStorage.removeItem('astra-checkin');
                }}
              >
                <RotateCcw size={15} />
                Start another assessment
              </button>
            </>
          )}
          {session && index < 6 && (
            <button className="button quiet full cancel-button" disabled={busy} onClick={cancel}>
              Cancel this check-in
            </button>
          )}
        </Panel>
      </div>
    </>
  );
}
