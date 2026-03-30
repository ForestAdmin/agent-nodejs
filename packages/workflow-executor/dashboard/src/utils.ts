import type { EventCategory } from './types';

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
