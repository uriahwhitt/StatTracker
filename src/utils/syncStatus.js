// ── Sync status — network connectivity indicator ──────────────────────────────
// Tracks online/offline state via browser events.
// Call initSyncStatus() once on app mount.

let _listeners = new Set();
let _status = 'unknown'; // 'connected' | 'disconnected' | 'unknown'

export const initSyncStatus = () => {
  const update = (status) => {
    _status = status;
    _listeners.forEach(fn => fn(status));
  };
  window.addEventListener('online',  () => update('connected'));
  window.addEventListener('offline', () => update('disconnected'));
  update(navigator.onLine ? 'connected' : 'disconnected');
};

export const getSyncStatus = () => _status;

export const onSyncStatusChange = (fn) => {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
};
