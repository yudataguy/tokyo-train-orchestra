import { CF_BEACON_TOKEN, cfBeaconScript } from '../analytics';

/** Runs the inline guard against a fake page and returns what it injected. */
function run(search: string, stored: string | null = null) {
  const store = new Map<string, string>();
  if (stored !== null) store.set('tv-notrack', stored);
  const appended: Array<{ src: string; attrs: Record<string, string>; defer: boolean }> = [];
  const document = {
    createElement: () => {
      const el = { src: '', defer: false, attrs: {} as Record<string, string>,
        setAttribute(k: string, v: string) { el.attrs[k] = v; } };
      return el;
    },
    head: { appendChild: (el: (typeof appended)[number]) => appended.push(el) },
  };
  const localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  new Function('location', 'localStorage', 'document', cfBeaconScript)(
    { search }, localStorage, document);
  return { appended, store };
}

test('injects the Cloudflare beacon with the japantv.app token', () => {
  const { appended } = run('');
  expect(appended).toHaveLength(1);
  expect(appended[0].src).toBe('https://static.cloudflareinsights.com/beacon.min.js');
  expect(appended[0].defer).toBe(true);
  expect(JSON.parse(appended[0].attrs['data-cf-beacon'])).toEqual({ token: CF_BEACON_TOKEN });
});

test('?notrack opts this browser out, persistently', () => {
  const first = run('?notrack');
  expect(first.appended).toHaveLength(0);
  expect(first.store.get('tv-notrack')).toBe('1');
  expect(run('', '1').appended).toHaveLength(0);
});

test('?track clears the opt-out', () => {
  const { appended, store } = run('?track', '1');
  expect(appended).toHaveLength(1);
  expect(store.has('tv-notrack')).toBe(false);
});

test('blocked storage skips analytics instead of throwing', () => {
  const doc = { createElement: () => { throw new Error('unreachable'); }, head: {} };
  const blocked = { getItem: () => { throw new Error('SecurityError'); } };
  expect(() => new Function('location', 'localStorage', 'document', cfBeaconScript)(
    { search: '' }, blocked, doc)).not.toThrow();
});
