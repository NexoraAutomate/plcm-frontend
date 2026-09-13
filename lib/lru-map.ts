/**
 * Map with insertion-order LRU eviction when max size is exceeded.
 * get() refreshes recency by re-inserting the key.
 */
export class LruMap<K, V> {
  private readonly map = new Map<K, V>();

  constructor(private readonly maxSize: number) {
    if (maxSize < 1) {
      throw new Error('LruMap maxSize must be >= 1');
    }
  }

  get size() {
    return this.map.size;
  }

  has(key: K) {
    return this.map.has(key);
  }

  get(key: K): V | undefined {
    if (!this.map.has(key)) return undefined;
    const value = this.map.get(key) as V;
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key: K, value: V): this {
    if (this.map.has(key)) {
      this.map.delete(key);
    }
    this.map.set(key, value);
    while (this.map.size > this.maxSize) {
      const oldest = this.map.keys().next().value as K;
      this.map.delete(oldest);
    }
    return this;
  }

  delete(key: K) {
    return this.map.delete(key);
  }

  clear() {
    this.map.clear();
  }
}
