import type { EventCategory, EventPair, PairAttempt, PairStatus, RunGroup } from './types';

export function currentAttempt(pair: EventPair): PairAttempt {
  return pair.attempts[pair.attempts.length - 1];
}

export function eventCategory(type: string): EventCategory {
  if (type.startsWith('poll:')) return 'poll';
  if (type.startsWith('drain:')) return 'drain';
  return 'step';
}

export function formatTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  return `${h}:${m}:${s}.${ms}`;
}

export function formatDuration(ms: number | undefined): string {
  if (ms === undefined) return '...';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 10_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 1000)}s`;
}

export function trunc(s: unknown, max = 20): string {
  const str = typeof s === 'string' ? s : String(s ?? '');
  return str.length > max ? `${str.slice(0, max)}…` : str;
}

export function deriveRunStatus(pairs: EventPair[]): PairStatus {
  const statuses = pairs.map(p => currentAttempt(p).status);
  if (statuses.includes('error')) return 'error';
  if (statuses.includes('awaiting-input')) return 'awaiting-input';
  if (statuses.includes('running')) return 'running';
  return 'success';
}

export function groupByRun(pairs: EventPair[]): RunGroup[] {
  const stepPairs = pairs.filter(p => p.category === 'step');
  const map = new Map<string, EventPair[]>();

  for (const pair of stepPairs) {
    const runId = String(pair.attempts[0]?.startData.runId ?? 'unknown');
    const existing = map.get(runId);
    if (existing) {
      existing.push(pair);
    } else {
      map.set(runId, [pair]);
    }
  }

  const groups: RunGroup[] = [];

  for (const [runId, runPairs] of map) {
    const sorted = runPairs.sort((a, b) => a.id - b.id);
    const firstTime = sorted[0].attempts[0].startTime;

    let totalDurationMs = 0;
    const statuses = { running: 0, success: 0, error: 0, awaiting: 0 };

    for (const p of sorted) {
      const attempt = currentAttempt(p);
      if (attempt.durationMs) totalDurationMs += attempt.durationMs;
      if (attempt.status === 'running') statuses.running += 1;
      else if (attempt.status === 'success') statuses.success += 1;
      else if (attempt.status === 'error') statuses.error += 1;
      else if (attempt.status === 'awaiting-input') statuses.awaiting += 1;
    }

    groups.push({
      runId,
      pairs: sorted,
      firstTime,
      totalDurationMs,
      overallStatus: deriveRunStatus(sorted),
      statuses,
    });
  }

  return groups.sort((a, b) => a.firstTime.getTime() - b.firstTime.getTime());
}
