import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  ScanLine,
  HeartPulse,
  FlaskConical,
  Radio,
  Check,
  Clock,
  Orbit,
} from 'lucide-react';
import { useCrew } from '../app';
import { useApi, date, time } from '../services/api';
import type { Queue } from '../services/types';
import { PageTitle, Panel, Badge, Avatar, TextLink } from '../components/UI';
import Station from '../features/Station';
export default function Home() {
  const { crew, selected, select } = useCrew();
  const queue = useApi<Queue>('/communications', 3000);
  const review = crew.filter((c) => c.observations.some((o) => o.level === 'review')).length;
  const due = crew.filter((c) => c.reminder?.status === 'overdue').length;
  return (
    <>
      <PageTitle
        eyebrow="ARES PATHFINDER / MISSION HEALTH"
        title="A healthy crew. A mission forward."
        description="Your onboard health overview. Independent of the distance from Earth."
        action={
          <div className="mission-day">
            <span>MISSION DAY</span>
            <strong>
              128<span> / 540</span>
            </strong>
          </div>
        }
      />
      <div className="summary-grid">
        <div className="summary-cell">
          <div>
            <span>CREW ONBOARD</span>
            <strong>
              {String(crew.length).padStart(2, '0')}
              <small>personnel</small>
            </strong>
          </div>
          <HeartPulse />
        </div>
        <div className="summary-cell">
          <div>
            <span>OBSERVATIONS TO REVIEW</span>
            <strong>
              {String(review).padStart(2, '0')}
              <small>crew members</small>
            </strong>
          </div>
          <span className="status-dot amber-bg" />
        </div>
        <div className="summary-cell">
          <div>
            <span>WEEKLY LABS DUE</span>
            <strong>
              {String(due).padStart(2, '0')}
              <small>scheduled tests</small>
            </strong>
          </div>
          <FlaskConical />
        </div>
        <div className="summary-cell">
          <div>
            <span>ONBOARD PROCESSING</span>
            <strong className="summary-word">Autonomous</strong>
            <small>Local analysis available</small>
          </div>
          <Orbit />
        </div>
      </div>
      <div className="home-primary">
        <section className="hero-station panel">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="status-dot" /> MEDICAL STATION 01
            </div>
            <h2>
              Your next
              <br />
              check-in starts here.
            </h2>
            <p>
              Step into an integrated assessment.
              <br />
              Understand what’s changing, over time.
            </p>
            <Link className="button primary" to="/booth">
              <ScanLine size={17} /> Start health check-in <ArrowRight size={17} />
            </Link>
            <div className="hero-capabilities">
              <span>LOCAL CAMERA</span>
              <i /> <span>SIMULATED SENSORS</span>
              <i /> <span>PERSONAL INSIGHTS</span>
            </div>
          </div>
          <div className="hero-scene">
            <Station compact />
            <span className="scene-caption">
              <span className="status-dot" /> STATION READY <span>DRAG TO ORBIT</span>
            </span>
          </div>
          <div className="hero-coordinate">
            MED BAY / DECK 02 <span>01 — 07</span>
          </div>
        </section>
        <Panel
          title="Flight timeline"
          kicker="TODAY’S PRIORITIES"
          action={<Clock size={17} className="muted" />}
        >
          <div className="timeline">
            <div className="timeline-item">
              <span className="timeline-marker complete">
                <Check size={12} />
              </span>
              <small>ONBOARD</small>
              <h3>
                {crew.some((c) => c.synthetic)
                  ? 'Synthetic reference histories'
                  : 'Build your personal history'}
              </h3>
              <p>
                {crew.some((c) => c.synthetic)
                  ? 'Four weeks of seeded mission history.'
                  : 'Routine check-ins establish individual references.'}
              </p>
            </div>
            <div className="timeline-item">
              <span className="timeline-marker active" />
              <small>DAILY ASSESSMENT</small>
              <h3>Check in with your health</h3>
              <p>Camera, sensors and a short conversation.</p>
              <TextLink to="/booth">Enter assessment booth</TextLink>
            </div>
            <div className="timeline-item">
              <span className="timeline-marker amber-marker" />
              <small>WEEKLY LABORATORY</small>
              <h3>
                {due} {due === 1 ? 'test' : 'tests'} awaiting collection
              </h3>
              <p>Illustrative seven-day sampling schedule.</p>
              <TextLink to={`/astronaut/${selected}`}>View lab schedule</TextLink>
            </div>
          </div>
        </Panel>
      </div>
      <div className="home-secondary">
        <Panel
          title="Crew status"
          kicker="PEOPLE AT THE CENTER"
          action={<Badge tone="green">{crew.length} ONBOARD</Badge>}
        >
          <div className="crew-list">
            {crew.map((c) => (
              <Link
                to={`/astronaut/${c.id}`}
                key={c.id}
                className="crew-row"
                onClick={() => select(c.id)}
              >
                <Avatar name={c.name} color={c.color} />
                <div className="crew-info">
                  <h3>{c.name}</h3>
                  <span>{c.role}</span>
                </div>
                <div className="crew-latest">
                  <small>LAST CHECK-IN</small>
                  <span>
                    {date(c.latest_checkin)} · {time(c.latest_checkin)}
                  </span>
                </div>
                <Badge tone={c.observations.some((o) => o.level === 'review') ? 'amber' : 'green'}>
                  {c.observations.some((o) => o.level === 'review')
                    ? 'Review observations'
                    : c.latest_checkin
                      ? 'No flags recorded'
                      : 'Awaiting check-in'}
                </Badge>
                <ArrowUpRight size={16} />
              </Link>
            ))}
          </div>
          {!crew.length && <p className="muted">No crew profiles. Add one in Station settings.</p>}
        </Panel>
        <Panel
          title="Earth can wait. Health can’t."
          kicker="DELAY-TOLERANT CARE"
          className="earth-panel"
        >
          <div className="orbital-graphic">
            <div className="planet" />
            <span className="orbital-point" />
            <span className="orbital-line" />
          </div>
          <div className="connection-row">
            <Radio size={17} />
            <span>
              {queue.data?.settings.link_online
                ? 'Simulated Earth link online'
                : 'Simulated Earth link unavailable'}
            </span>
          </div>
          <p>
            Assessments run onboard. Reports are stored locally until a communication window opens.
          </p>
          <div className="earth-meta">
            <span>
              {queue.data?.messages.filter((m) => ['QUEUED', 'IN_TRANSIT'].includes(m.state))
                .length || 0}{' '}
              pending reports
            </span>
            <TextLink to="/mission-control">Open ground view</TextLink>
          </div>
        </Panel>
      </div>
    </>
  );
}
