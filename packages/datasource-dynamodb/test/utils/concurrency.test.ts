import { mapUntilSettled, mapWithConcurrency } from '../../src/utils/concurrency';

describe('mapWithConcurrency', () => {
  it('keeps the order of the results', async () => {
    const result = await mapWithConcurrency([3, 1, 2], 2, async n => n * 2);

    expect(result).toEqual([6, 2, 4]);
  });

  it('runs at most the given number of calls at once', async () => {
    let running = 0;
    let peak = 0;

    await mapWithConcurrency([1, 2, 3, 4, 5], 2, async () => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise(resolve => {
        setImmediate(resolve);
      });
      running -= 1;
    });

    expect(peak).toBe(2);
  });
});

describe('mapUntilSettled', () => {
  it('rejects only once the writes in flight have finished, and starts no new one', async () => {
    const finished: number[] = [];
    const started: number[] = [];

    await expect(
      mapUntilSettled([1, 2, 3, 4, 5, 6], 2, async n => {
        started.push(n);

        if (n === 1) throw new Error('boom');

        await new Promise(resolve => {
          setTimeout(resolve, 10);
        });
        finished.push(n);
      }),
    ).rejects.toThrow('boom');

    expect(finished).toContain(2);
    expect(started).not.toContain(6);
  });

  it('returns the results when nothing fails', async () => {
    expect(await mapUntilSettled([1, 2], 2, async n => n + 1)).toEqual([2, 3]);
  });
});
