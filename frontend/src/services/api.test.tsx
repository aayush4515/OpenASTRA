import { it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup, act } from '@testing-library/react';
import { useApi, label } from './api';
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('does not display one astronaut’s data while loading a different record', async () => {
  let finish: (v: unknown) => void = () => {};
  const pending = new Promise((resolve) => {
    finish = resolve;
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => ({
      ok: true,
      status: 200,
      json: () => (url === '/api/one' ? Promise.resolve({ name: 'First' }) : pending),
    })),
  );
  const hook = renderHook(({ path }) => useApi<{ name: string }>(path), {
    initialProps: { path: '/one' },
  });
  await waitFor(() => expect(hook.result.current.data?.name).toBe('First'));
  hook.rerender({ path: '/two' });
  expect(hook.result.current.data).toBeUndefined();
  expect(hook.result.current.loading).toBe(true);
  await act(async () => finish({ name: 'Second' }));
  expect(hook.result.current.data?.name).toBe('Second');
});
it('formats API state enums consistently', () => {
  expect(label('ACKNOWLEDGED')).toBe('Acknowledged');
  expect(label('IN_TRANSIT')).toBe('In Transit');
});
