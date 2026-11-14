import type { ReactNode } from 'react';
import { ArrowUpRight, AlertTriangle, LoaderCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Observation, Metric } from '../services/types';
import { label } from '../services/api';
export function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-title">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </header>
  );
}
export function Panel({
  title,
  kicker,
  children,
  className = '',
  action,
}: {
  title?: string;
  kicker?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <section className={'panel ' + className}>
      {title && (
        <div className="panel-heading">
          <div>
            {kicker && <div className="eyebrow">{kicker}</div>}
            <h2>{title}</h2>
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) {
  return <span className={'badge ' + tone}>{children}</span>;
}
export function ErrorBox({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div role="alert" className="error-box">
      <AlertTriangle size={18} />
      <span>{message}</span>
      {retry && <button onClick={retry}>Retry</button>}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" /> Connecting to the local station…
    </div>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}
export function Avatar({ name, color }: { name: string; color: string }) {
  return (
    <span className="avatar" style={{ '--crew-color': color } as React.CSSProperties}>
      {name
        .split(' ')
        .map((n) => n[0])
        .join('')}
    </span>
  );
}
export function MetricCard({ metric }: { metric: Metric }) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label(metric.metric)}</div>
      <div className="metric-number">
        {metric.value}
        <span>{metric.unit}</span>
      </div>
      <div className={'metric-delta ' + (metric.score && metric.score >= 3 ? 'amber' : 'mint')}>
        {metric.baseline === null
          ? 'Building reference'
          : `${metric.delta! >= 0 ? '+' : ''}${metric.delta?.toFixed(1)} from personal reference`}
      </div>
      <small>
        {metric.simulated ? 'SIMULATED' : 'MEASURED'} · {metric.domain}
      </small>
    </div>
  );
}
export function Observations({
  items,
  compact = false,
}: {
  items: Observation[];
  compact?: boolean;
}) {
  return (
    <div className="observations">
      {items.map((o, i) => (
        <article className={'observation ' + o.level} key={i}>
          <span className="status-dot" />
          <div>
            <div className="observation-heading">
              <h3>{o.title}</h3>
              <Badge tone={o.level === 'routine' ? 'green' : 'amber'}>{o.level}</Badge>
            </div>
            <p>{o.evidence}</p>
            {!compact && (
              <>
                <div className="next-step">{o.next_step}</div>
                <small>{o.provenance} · Demonstration guidance, pending clinical review</small>
              </>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
export function TextLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link className="text-link" to={to}>
      {children}
      <ArrowUpRight size={15} />
    </Link>
  );
}
