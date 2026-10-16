/** Maps with at most `limit` calls in flight, keeping the order of the results. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  handler: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  const worker = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      // eslint-disable-next-line no-await-in-loop
      results[index] = await handler(items[index], index);
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));

  return results;
}

/**
 * Like mapWithConcurrency, for writes: once one fails nothing new is started, and the call only
 * rejects after the writes already in flight have finished, so what follows sees their effect.
 */
export async function mapUntilSettled<T, R>(
  items: T[],
  limit: number,
  handler: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  let failure: { error: unknown } | undefined;

  const results = await mapWithConcurrency(items, limit, async (item, index) => {
    if (failure) return undefined;

    try {
      return await handler(item, index);
    } catch (error) {
      failure ??= { error };

      return undefined;
    }
  });

  if (failure) throw failure.error;

  return results;
}

export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));

  return chunks;
}

export const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => {
    setTimeout(resolve, ms);
  });
