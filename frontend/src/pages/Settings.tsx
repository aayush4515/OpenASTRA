import { useState } from 'react';
import { UserPlus, Trash2, Save, ShieldCheck } from 'lucide-react';
import { useCrew } from '../app';
import { api } from '../services/api';
import type { FacialCapture } from '../services/types';
import { PageTitle, Panel, Badge, ErrorBox } from '../components/UI';
import Camera from '../features/Camera';
export default function Settings() {
  const { crew, selected, refresh, role } = useCrew();
  const person = crew.find((c) => c.id === selected);
  const [name, setName] = useState('');
  const [job, setJob] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [enroll, setEnroll] = useState(false);
  const [deletion, setDeletion] = useState('');
  const [reset, setReset] = useState('');
  const [interval, setInterval] = useState<number>();
  async function act(path: string, method: string, body?: unknown, success = 'Saved locally.') {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await api(path, method, body);
      setNotice(success);
      refresh();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="STATION CONFIGURATION / LOCAL DATA"
        title="Your station. Your records."
        description="Manage crew profiles, camera consent and the demonstration environment."
      />
      {error && <ErrorBox message={error} />}{' '}
      {notice && (
        <div className="saved-notice" role="status">
          <ShieldCheck size={17} />
          {notice}
        </div>
      )}
      <div className="settings-grid">
        <Panel title="Add a crew profile" kicker="LOCAL SQLITE">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (await act('/astronauts', 'POST', { name, role: job })) {
                setName('');
                setJob('');
              }
            }}
          >
            <label>
              Full name
              <input
                required
                minLength={2}
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              Mission role
              <input
                required
                minLength={2}
                maxLength={80}
                value={job}
                onChange={(e) => setJob(e.target.value)}
              />
            </label>
            <p className="fine-print">
              New profiles start without personal reference data. The station will identify missing
              history rather than claim a normal result.
            </p>
            <button className="button primary" disabled={busy}>
              <UserPlus size={16} />
              Create local profile
            </button>
          </form>
        </Panel>
        <Panel title="Assessment preferences" kicker={person?.name.toUpperCase() || 'SELECT CREW'}>
          <label>
            Blood-test interval (days)
            <input
              type="number"
              aria-label="Blood-test interval"
              min={1}
              max={90}
              value={interval ?? person?.lab_interval_days ?? 7}
              onChange={(e) => setInterval(+e.target.value)}
            />
          </label>
          <p className="fine-print">
            Demonstration schedule only. Reminders refresh while the app is open and when it
            restarts. No notifications fire when the app is stopped.
          </p>
          <button
            className="button secondary"
            disabled={busy || !person}
            onClick={() =>
              act(`/astronauts/${selected}`, 'PATCH', {
                name: person!.name,
                role: person!.role,
                mission: person!.mission,
                lab_interval_days: interval ?? person!.lab_interval_days,
              })
            }
          >
            <Save size={16} />
            Save schedule
          </button>
          <div className="input-note">
            Voice: local speech recognition is not installed. Typed and selectable answers are
            always available.
          </div>
        </Panel>
      </div>
      <Panel
        title="Local facial reference enrollment"
        kicker="CONSENT & CAMERA PRIVACY"
        action={
          <Badge tone={person?.enrolled ? 'green' : 'neutral'}>
            {person?.enrolled ? 'REFERENCE ENROLLED' : 'NOT ENROLLED'}
          </Badge>
        }
      >
        <p>
          Enroll a valid landmark reference for {person?.name}. Identity remains manually confirmed.
          This prototype does not compute identity embeddings or claim face recognition. Raw images
          are not stored.
        </p>
        {!enroll ? (
          <button className="button secondary" disabled={!person} onClick={() => setEnroll(true)}>
            Open enrollment camera
          </button>
        ) : (
          <div className="enrollment-camera">
            <Camera
              onCapture={async (facial: FacialCapture) => {
                if (
                  await act(
                    '/enrollment',
                    'POST',
                    { astronaut_id: selected, facial },
                    'Local facial reference saved. Identity still requires manual confirmation.',
                  )
                )
                  setEnroll(false);
              }}
              onSkip={() => setEnroll(false)}
            />
          </div>
        )}
        <button
          className="button quiet"
          disabled={busy || !person}
          onClick={() =>
            act(
              `/enrollment/${selected}`,
              'DELETE',
              undefined,
              'Facial references and stored facial measurements removed. Check-in vitals are retained.',
            )
          }
        >
          Delete local facial references
        </button>
      </Panel>
      <Panel title="Data retention" kicker="LOCAL PRIVACY">
        <p>
          Records persist in a local SQLite file until explicitly deleted. The file is not encrypted
          by this prototype. Use a protected workstation and disk encryption. Local role selection
          is for demonstration, not secure authentication.
        </p>
        <label>
          Delete selected profile and its linked records: type “{person?.name}”
          <input
            aria-label="Profile deletion confirmation"
            value={deletion}
            onChange={(e) => setDeletion(e.target.value)}
            placeholder="Exact crew name"
          />
        </label>
        <button
          className="button danger"
          disabled={busy || !person || deletion !== person.name}
          onClick={async () => {
            if (
              await act(
                `/astronauts/${selected}?confirmation=${encodeURIComponent(deletion)}`,
                'DELETE',
                undefined,
                'Profile and linked local records deleted.',
              )
            )
              setDeletion('');
          }}
        >
          <Trash2 size={16} />
          Delete profile and records
        </button>
      </Panel>
      <Panel title="Reset the synthetic demonstration" kicker="DEMO MAINTENANCE">
        <p>
          Rebuild only the three fictional crew members and their seeded histories. User-created
          profiles are preserved. This clears all check-ins and camera data attached to the
          fictional crew.
        </p>
        <label>
          Type RESET SYNTHETIC DEMO
          <input
            aria-label="Demo reset confirmation"
            value={reset}
            onChange={(e) => setReset(e.target.value)}
          />
        </label>
        <button
          className="button danger"
          disabled={busy || role !== 'mission_control' || reset !== 'RESET SYNTHETIC DEMO'}
          onClick={async () => {
            if (
              await act(
                '/demo/reset',
                'POST',
                { confirmation: reset },
                'Synthetic crew histories rebuilt. User-created profiles preserved.',
              )
            )
              setReset('');
          }}
        >
          Reset synthetic demo records
        </button>
        {role !== 'mission_control' && (
          <p className="fine-print">
            Select the Mission Control demo role to enable maintenance controls.
          </p>
        )}
      </Panel>
    </>
  );
}
