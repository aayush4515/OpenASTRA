export type Observation = {
  category: string;
  level: string;
  title: string;
  evidence: string;
  next_step: string;
  provenance: string;
  metrics: string[];
};
export type Metric = {
  metric: string;
  value: number;
  unit: string;
  baseline: number | null;
  score: number | null;
  delta: number | null;
  trend: number;
  count: number;
  domain: string;
  source: string;
  simulated: boolean;
};
export type Reading = {
  id: string;
  metric: string;
  value: number;
  unit: string;
  timestamp: string;
  source: string;
  simulated: boolean;
  quality: string;
  domain: string;
  context: string;
};
export type FacialCapture = {
  features: Record<string, number>;
  quality: Record<string, number>;
  source: 'live_camera' | 'synthetic_fixture';
  consent: boolean;
};
export type FaceComparison = {
  status: string;
  message: string;
  changes: { metric: string; value: number; baseline: number; score: number; flagged: boolean }[];
  source?: string;
};
export type Assessment = {
  metrics: Metric[];
  observations: Observation[];
  voc: { status: string; channels: number[]; baseline: number[]; scores: number[] };
  facial: FaceComparison | null;
  missing_baselines: string[];
  baseline_policy: string;
  limitations: string;
  missing_data?: string[];
};
export type Checkin = {
  id: string;
  astronaut_id: string;
  timestamp: string;
  state: string;
  scenario: string;
  draft: { readings?: Reading[]; facial_comparison?: FaceComparison; voc?: number[] };
  result: Assessment;
};
export type Reminder = {
  astronaut_id: string;
  due_at: string;
  last_completed: string | null;
  status: string;
};
export type Lab = {
  id: string;
  timestamp: string;
  state: string;
  results: { metric: string; value: number; unit: string; source: string; simulated: boolean }[];
};
export type Astronaut = {
  id: string;
  name: string;
  role: string;
  mission: string;
  color: string;
  synthetic: boolean;
  lab_interval_days: number;
  latest_checkin?: string;
  observations: Observation[];
  reminder: Reminder;
  enrolled: boolean;
};
export type Dashboard = Astronaut & {
  checkins: Checkin[];
  readings: Reading[];
  baselines: { metric: string; median: number; scale: number; count: number }[];
  facial: {
    timestamp: string;
    features: Record<string, number>;
    source: string;
    valid: boolean;
    quality: Record<string, number>;
  }[];
  blood_tests: Lab[];
};
export type LinkSettings = { link_online: boolean; delay_seconds: number };
export type Message = {
  id: string;
  astronaut_id: string;
  kind: string;
  state: string;
  created_at: string;
  history: { state: string; at: string }[];
  payload: {
    checkin_id?: string;
    assessment?: Assessment;
    event?: string;
    results?: Lab['results'];
  };
};
export type Queue = { settings: LinkSettings; messages: Message[] };
export type EmergencyEvent = {
  id: string;
  astronaut_id: string;
  timestamp: string;
  event: string;
  protocol: string[];
  resolved: boolean;
  crew_notified: boolean;
};
export type Answers = {
  wellbeing: number;
  fatigue: string;
  sleep_quality: string;
  mood: string;
  symptoms: string;
  notes: string;
  followup: string;
};
