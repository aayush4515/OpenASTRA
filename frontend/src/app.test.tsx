import { afterEach, beforeEach, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import App from './app';
import fixture from './__fixtures__/mission.json';
vi.mock('./features/Station', () => ({
  default: () => <div data-testid="station">Procedural station test boundary</div>,
  equipment: [
    { id: 'camera', name: 'Optical array', detail: 'Live camera' },
    { id: 'vitals', name: 'Vitals console', detail: 'Simulated vitals' },
  ],
}));
vi.mock('./components/Charts', () => ({
  TrendChart: () => <div>Trend chart</div>,
  VocChart: () => <div>VOC chart</div>,
  FaceChart: () => <div>Face chart</div>,
}));
let requests: { url: string; body: Record<string, unknown>; method: string }[] = [];
let checkin: any;
let messages: any[] = [];
let events: any[] = [];
let online = true;
beforeEach(() => {
  history.replaceState({}, '', '/');
  localStorage.clear();
  sessionStorage.clear();
  requests = [];
  messages = [];
  events = [];
  online = true;
  checkin = undefined;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, options: RequestInit = {}) => {
      const body = options.body ? JSON.parse(String(options.body)) : {};
      requests.push({ url, body, method: options.method || 'GET' });
      let result: any = {};
      if (url === '/api/astronauts') result = fixture.crew;
      else if (url.startsWith('/api/astronauts/'))
        result = { ...fixture.dashboard, id: url.split('/').pop() };
      else if (url.startsWith('/api/health-analysis/'))
        result = fixture.dashboard.checkins[0].result;
      else if (url === '/api/checkins') {
        checkin = {
          id: 'test-checkin',
          astronaut_id: body.astronaut_id,
          state: 'IDENTIFYING',
          scenario: body.scenario,
          draft: {},
          result: {},
        };
        result = checkin;
      } else if (url.endsWith('/advance')) {
        const transitions: Record<string, string> = {
          IDENTIFYING: 'IDENTITY_CONFIRMED',
          IDENTITY_CONFIRMED: 'FACIAL_SCAN',
          FACIAL_SCAN: 'SENSOR_COLLECTION',
          SENSOR_COLLECTION: 'VOC_SCAN',
          VOC_SCAN: 'QUESTIONNAIRE',
          QUESTIONNAIRE: 'PROCESSING',
          PROCESSING: 'RESULTS_READY',
          RESULTS_READY: 'COMPLETED',
        };
        checkin = {
          ...checkin,
          state: transitions[checkin.state],
          result: fixture.dashboard.checkins[0].result,
        };
        result = checkin;
      } else if (url.startsWith('/api/questionnaires/')) result = { followups: [], voice: 'typed' };
      else if (url === '/api/communications/settings') {
        online = body.link_online;
        result = body;
      } else if (url.startsWith('/api/communications/report/')) {
        messages.push({
          id: 'm1',
          astronaut_id: 'AST-001',
          kind: 'health_report',
          created_at: new Date().toISOString(),
          state: online ? 'DELIVERED' : 'QUEUED',
          payload: { assessment: fixture.dashboard.checkins[0].result },
          history: [],
        });
        result = messages[0];
      } else if (url.endsWith('/acknowledge')) {
        messages[0].state = 'ACKNOWLEDGED';
        result = messages[0];
      } else if (url === '/api/communications')
        result = { settings: { link_online: online, delay_seconds: 10 }, messages };
      else if (url === '/api/mission-control')
        result = {
          crew: fixture.crew,
          reports: messages.filter((m) => ['DELIVERED', 'ACKNOWLEDGED'].includes(m.state)),
        };
      else if (url === '/api/emergencies' && options.method === 'POST') {
        result = {
          id: 'e1',
          astronaut_id: body.astronaut_id,
          event: body.event,
          timestamp: new Date().toISOString(),
          resolved: false,
          crew_notified: true,
          protocol: ['Alert other crew now.'],
        };
        events.push(result);
      } else if (url === '/api/emergencies') result = events;
      else if (url.endsWith('/resolve')) {
        events[0].resolved = true;
        result = events[0];
      }
      return { ok: true, status: 200, json: async () => structuredClone(result) } as Response;
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('navigates all primary routes and changes the selected astronaut', async () => {
  render(<App />);
  expect(
    await screen.findByRole('heading', { name: 'A healthy crew. A mission forward.' }),
  ).toBeInTheDocument();
  const nav = screen.getByRole('navigation', { name: 'Main navigation' });
  await screen.findByRole('option', { name: 'Rafael Okafor' });
  fireEvent.change(screen.getByLabelText('Active crew member'), { target: { value: 'AST-002' } });
  fireEvent.click(within(nav).getByRole('link', { name: 'Crew health' }));
  await waitFor(() => expect(requests.some((r) => r.url === '/api/astronauts/AST-002')).toBe(true));
  expect(await screen.findByRole('heading', { name: 'Maya Chen' })).toBeInTheDocument();
  fireEvent.click(within(nav).getByRole('link', { name: 'Health intelligence' }));
  expect(
    await screen.findByRole('heading', { name: 'Understand the change.' }),
  ).toBeInTheDocument();
  fireEvent.click(within(nav).getByRole('link', { name: 'Station settings' }));
  expect(
    await screen.findByRole('heading', { name: 'Your station. Your records.' }),
  ).toBeInTheDocument();
  fireEvent.click(within(nav).getByRole('link', { name: 'Assessment booth' }));
  expect(await screen.findByRole('button', { name: 'Begin check-in' })).toBeInTheDocument();
});
it('drives a complete manual-fallback check-in through every server state', async () => {
  history.replaceState({}, '', '/booth');
  render(<App />);
  const begin = await screen.findByRole('button', { name: 'Begin check-in' });
  await waitFor(() => expect(begin).toBeEnabled());
  fireEvent.click(begin);
  for (const name of [
    'Confirm Maya Chen',
    'Open optical assessment',
    'Continue without camera',
    'Collect simulated readings',
    'Collect VOC fingerprint',
    'Complete questionnaire',
    'Analyze & save assessment',
    'Finish check-in',
  ]) {
    const button = await screen.findByRole('button', { name });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
  }
  expect(await screen.findByRole('link', { name: 'View health dashboard' })).toBeInTheDocument();
  expect(
    requests.filter((r) => r.url.endsWith('/advance')).map((r) => r.body.expected_state),
  ).toEqual([
    'IDENTIFYING',
    'IDENTITY_CONFIRMED',
    'FACIAL_SCAN',
    'SENSOR_COLLECTION',
    'VOC_SCAN',
    'QUESTIONNAIRE',
    'PROCESSING',
    'RESULTS_READY',
  ]);
  expect(sessionStorage.getItem('astra-checkin')).toBeNull();
});
it('activates an emergency without starting a check-in', async () => {
  history.replaceState({}, '', '/emergency');
  render(<App />);
  const button = await screen.findByRole('button', { name: 'Activate emergency simulation' });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  expect(
    await screen.findByText('Event saved locally. Mission Control report queued.'),
  ).toBeInTheDocument();
  expect(
    requests.some(
      (r) => r.url === '/api/emergencies' && r.body.event === 'Chest pain and collapse',
    ),
  ).toBe(true);
  expect(requests.some((r) => r.url === '/api/checkins')).toBe(false);
});
it('requires ground role and operates actual queued-record controls', async () => {
  history.replaceState({}, '', '/mission-control');
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Enter Mission Control demo role' }));
  expect(await screen.findByRole('heading', { name: 'Across the distance.' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Queue health report' }));
  const ack = await screen.findByRole('button', { name: 'Acknowledge' });
  await waitFor(() => expect(ack).toBeEnabled());
  fireEvent.click(ack);
  expect(await screen.findByText('Acknowledged')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Disconnect Earth link' }));
  expect(await screen.findByRole('button', { name: 'Restore Earth link' })).toBeInTheDocument();
  expect(requests.find((r) => r.url === '/api/communications/settings')?.body).toEqual({
    link_online: false,
    delay_seconds: 10,
  });
  expect(localStorage.getItem('astra-role')).toBe('mission_control');
});
