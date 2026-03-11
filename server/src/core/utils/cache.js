export class TtlCache {
  constructor({ ttlMs }) {
    this.ttlMs = ttlMs;
    this.store = new Map();
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > this.ttlMs) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key, value) {
    this.store.set(key, { value, ts: Date.now() });
  }
}