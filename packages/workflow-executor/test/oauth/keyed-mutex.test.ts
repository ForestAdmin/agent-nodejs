import KeyedMutex from '../../src/oauth/keyed-mutex';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

describe('KeyedMutex', () => {
  describe('runExclusive', () => {
    it('returns the value the task resolves with', async () => {
      const mutex = new KeyedMutex();

      await expect(mutex.runExclusive('k', async () => 42)).resolves.toBe(42);
    });

    it('runs tasks sharing a key one at a time, in order', async () => {
      const mutex = new KeyedMutex();
      const events: string[] = [];
      const first = deferred<void>();

      const firstRun = mutex.runExclusive('user:1', async () => {
        events.push('first:start');
        await first.promise;
        events.push('first:end');
      });

      const secondRun = mutex.runExclusive('user:1', async () => {
        events.push('second:start');
      });

      // The second task must not start while the first holds the key.
      await Promise.resolve();
      expect(events).toEqual(['first:start']);

      first.resolve();
      await Promise.all([firstRun, secondRun]);

      expect(events).toEqual(['first:start', 'first:end', 'second:start']);
    });

    it('runs tasks for different keys concurrently', async () => {
      const mutex = new KeyedMutex();
      const events: string[] = [];
      const blocker = deferred<void>();

      const blocked = mutex.runExclusive('user:1', async () => {
        events.push('a:start');
        await blocker.promise;
      });
      const other = mutex.runExclusive('user:2', async () => {
        events.push('b:start');
      });

      await other;
      // 'user:2' completed without waiting for the still-blocked 'user:1'.
      expect(events).toEqual(['a:start', 'b:start']);

      blocker.resolve();
      await blocked;
    });

    it('lets a later task on the same key run after an earlier task rejects', async () => {
      const mutex = new KeyedMutex();

      const failed = mutex.runExclusive('user:1', async () => {
        throw new Error('boom');
      });

      await expect(failed).rejects.toThrow('boom');
      await expect(mutex.runExclusive('user:1', async () => 'ok')).resolves.toBe('ok');
    });
  });
});
