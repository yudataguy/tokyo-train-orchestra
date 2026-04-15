/**
 * IndexedDB-backed cache for the bundled timetable JSON. Keeps data across
 * visits so we skip the 555KB (gzipped) download when the server-side version
 * hasn't changed.
 *
 * Design:
 *   - Single object store 'timetables' with a single record at key 'tokyometro'.
 *   - The record holds { version, data }.
 *   - On read, we HEAD-ish the server payload by asking for just `version`
 *     (we actually fetch the full file, but the flow could be optimized later
 *     by exposing a small /timetables-version.json beside it). For now the
 *     client compares cached.version to the fetched payload's version.
 *   - If network fails, we fall back to the cached copy if present.
 */

const DB_NAME = 'tokyo-train-orchestra';
const DB_VERSION = 1;
const STORE = 'timetables';
const KEY = 'tokyometro';

interface CachedRecord<T> {
  version: string;
  data: T;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
  });
}

async function readCached<T>(): Promise<CachedRecord<T> | null> {
  try {
    const db = await openDB();
    return await new Promise<CachedRecord<T> | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(KEY);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve((req.result as CachedRecord<T>) ?? null);
    });
  } catch {
    return null;
  }
}

async function writeCached<T>(record: CachedRecord<T>): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(record, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Cache failures shouldn't break the app — just fall through silently.
  }
}

export interface TimetablePayload<TData> {
  version: string;
  lines: TData;
}

async function fetchVersion(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const body = (await res.json()) as { version?: string };
    return body.version ?? null;
  } catch {
    return null;
  }
}

/**
 * Load the timetable payload, using the IndexedDB cache when possible.
 *
 * Flow:
 *   1. Fetch the tiny version sidecar (~30 bytes).
 *   2. If cache has the same version, return cached data (0 big-payload downloads).
 *   3. Otherwise fetch the full payload, write to cache, return it.
 *   4. If the version probe fails but we have any cached copy, serve that.
 */
export async function loadTimetables<TData>(
  url: string,
  versionUrl: string,
): Promise<TimetablePayload<TData>> {
  const cached = await readCached<TData>();
  const remoteVersion = await fetchVersion(versionUrl);

  if (cached && remoteVersion && cached.version === remoteVersion) {
    return { version: cached.version, lines: cached.data };
  }

  // Either no cache, version drift, or version probe failed. Fetch the big file.
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const network = (await res.json()) as TimetablePayload<TData>;
    void writeCached({ version: network.version, data: network.lines });
    return network;
  } catch (err) {
    if (cached) return { version: cached.version, lines: cached.data };
    throw err;
  }
}
