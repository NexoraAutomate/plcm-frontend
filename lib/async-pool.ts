/**
 * Run an async mapper over items with a fixed concurrency limit.
 * Preserves result order.
 */
export async function mapPool<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const count = items.length;
  if (count === 0) return [];

  const limit = Math.max(1, Math.min(concurrency, count));
  const results = new Array<R>(count);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex++;
      if (index >= count) return;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: limit }, () => worker()));
  return results;
}
