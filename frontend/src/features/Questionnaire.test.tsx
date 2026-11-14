import { it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import Questionnaire from './Questionnaire';
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('loads server-defined adaptive questions and submits selected user responses', async () => {
  const fetcher = vi.fn(async (url: string) => ({
    ok: true,
    status: 200,
    json: async () => ({
      followups: url.includes('dizziness') ? ['When did the dizziness begin?'] : [],
      voice: 'typed',
    }),
  }));
  vi.stubGlobal('fetch', fetcher);
  const submit = vi.fn();
  render(<Questionnaire checkinId="test" onSubmit={submit} busy={false} />);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Complete questionnaire' })).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Dizziness' }));
  const text = await screen.findByLabelText('When did the dizziness begin?');
  fireEvent.change(text, { target: { value: 'Started after exercise' } });
  fireEvent.click(screen.getByRole('button', { name: 'Unusual' }));
  fireEvent.click(screen.getByRole('button', { name: 'Complete questionnaire' }));
  expect(submit).toHaveBeenCalledWith(
    expect.objectContaining({
      symptoms: 'dizziness',
      fatigue: 'unusual',
      followup: 'Started after exercise',
    }),
  );
  expect(screen.getByText(/No microphone is required/)).toBeInTheDocument();
});
