import { it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import BloodTest from './BloodTest';
vi.mock('./Station', () => ({ default: () => <div>3D station mock</div> }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('completes the real API-driven lab state sequence and refreshes reminders', async () => {
  const states = ['PREPARED', 'SAMPLE_LOADED', 'ANALYZING', 'COMPLETED'];
  let n = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ id: 'lab-1', state: states[n++], results: [] }),
    })),
  );
  const complete = vi.fn();
  render(
    <BloodTest
      astronautId="a"
      tests={[]}
      reminder={{
        astronaut_id: 'a',
        due_at: '2026-11-14',
        last_completed: null,
        status: 'overdue',
      }}
      onComplete={complete}
    />,
  );
  for (const text of [
    'Start simulated blood test',
    'Load simulated sample',
    'Run simulated analysis',
    'Save lab results',
  ]) {
    fireEvent.click(await screen.findByRole('button', { name: text }));
    await waitFor(() => expect(n).toBeGreaterThan(0));
  }
  await waitFor(() => expect(complete).toHaveBeenCalledOnce());
  expect(await screen.findByText(/Lab results saved/)).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledTimes(4);
});
