import { performance } from 'node:perf_hooks';

export default class Benchmark {
  private _times = 1;

  times(times: number): this {
    if (times < 1) throw new Error('Times must be greater than 0');
    this._times = times;

    return this;
  }

  async run(func: () => Promise<void>): Promise<{
    durations: number[];
    times: number;
    average: number;
    min: number;
    max: number;
    total: number;
  }> {
    const durations: number[] = [];

    for (let i = 0; i < this._times; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const start = performance.now();
      // eslint-disable-next-line no-await-in-loop
      await func();
      const end = performance.now();
      const duration = end - start;
      durations.push(duration);
    }

    return {
      times: this._times,
      durations,
      average: durations.reduce((acc, curr) => acc + curr, 0) / this._times,
      total: durations.reduce((acc, curr) => acc + curr, 0),
      min: Math.min(...durations),
      max: Math.max(...durations),
    };
  }
}
