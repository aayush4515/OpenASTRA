import { useCallback, useEffect, useState } from 'react';
export function currentRole() {
  return localStorage.getItem('astra-role') || 'astronaut';
}
export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch('/api' + path, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Astra-Role': currentRole() },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail));
    }
    return res.status === 204 ? (undefined as T) : await res.json();
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError')
      throw new Error('The local service did not respond in time. Retry when it is available.');
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
export function useApi<T>(path: string, poll = 0) {
  const [snapshot, setSnapshot] = useState<{ path: string; value: T }>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    const load = () =>
      api<T>(path)
        .then((v) => {
          if (active) {
            setSnapshot({ path, value: v });
            setError('');
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    load();
    const timer = poll ? setInterval(load, poll) : undefined;
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [path, poll, version]);
  return {
    data: snapshot?.path === path ? snapshot.value : undefined,
    error,
    loading: loading || (snapshot?.path !== path && !error),
    refresh,
  };
}
export const label = (s: string) =>
  s
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
export const date = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'No record';
export const time = (s?: string) =>
  s ? new Date(s).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '—';
