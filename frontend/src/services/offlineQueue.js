import api from "./api";

/**
 * Offline operation queue — persists pending write operations (sales,
 * purchases, payments, expenses) in localStorage while offline and replays
 * them against the API once connectivity returns.
 */
const KEY = "bh_offline_queue";
const listeners = new Set();

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
}

function write(queue) {
  localStorage.setItem(KEY, JSON.stringify(queue));
  listeners.forEach((fn) => fn(queue));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getQueue() {
  return read();
}

export function queueSize() {
  return read().length;
}

/** Queue an operation to sync later. Returns its local id. */
export function enqueue({ label, url, method = "POST", body }) {
  const queue = read();
  const op = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label,
    url,
    method,
    body,
    createdAt: new Date().toISOString(),
    attempts: 0,
  };
  queue.push(op);
  write(queue);
  return op.id;
}

/**
 * Submit an operation now, or queue it for later if offline / network fails.
 * - Online + success  → resolves { queued: false, data }
 * - Offline / network error → enqueues and resolves { queued: true, id }
 * - Online + server error (4xx/5xx) → throws so the page can show the error
 */
export async function submitOrQueue({ label, url, method = "POST", body, onSuccess }) {
  if (!navigator.onLine) {
    const id = enqueue({ label, url, method, body });
    return { queued: true, id };
  }
  try {
    const res = await api({ method, url, data: body });
    if (onSuccess) onSuccess(res.data);
    return { queued: false, data: res.data };
  } catch (err) {
    if (!err.response) {
      const id = enqueue({ label, url, method, body });
      return { queued: true, id };
    }
    throw err;
  }
}

/** Replay queued operations in order. Stops on first failure (keeps order). */
export async function flushQueue() {
  if (!navigator.onLine) return { synced: 0, remaining: queueSize() };
  let synced = 0;
  let queue = read();
  while (queue.length) {
    const op = queue[0];
    try {
      await api({ method: op.method, url: op.url, data: op.body });
      queue = queue.slice(1);
      write(queue);
      synced++;
    } catch (err) {
      // 4xx = bad request that will never succeed — drop it
      if (err.response?.status >= 400 && err.response?.status < 500) {
        queue = queue.slice(1);
        write(queue);
      } else {
        break;
      }
    }
  }
  return { synced, remaining: queueSize() };
}

let initialized = false;

/** Auto-flush when coming back online and on app start. */
export function initOfflineSync(onSynced) {
  if (initialized) return;
  initialized = true;

  const run = async () => {
    if (!queueSize()) return;
    const { synced, remaining } = await flushQueue();
    if (synced && onSynced) onSynced(synced, remaining);
  };

  window.addEventListener("online", run);
  window.addEventListener("load", run);
  setTimeout(run, 3000);
}
