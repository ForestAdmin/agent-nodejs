import { invalidTimezone, missingTimezone } from '../http/bff-http-error';

const VALID_TIMEZONES = new Set<string>();

export interface TimezoneSources {
  header?: string;
  body?: string;
  fallback?: string;
}

export function isValidTimezone(value: string): boolean {
  if (value === '') return false;
  if (VALID_TIMEZONES.has(value)) return true;

  try {
    Intl.DateTimeFormat('en-US', { timeZone: value });
  } catch {
    return false;
  }

  VALID_TIMEZONES.add(value);

  return true;
}

export function resolveTimezone({ header, body, fallback }: TimezoneSources): string {
  const candidate = [header, body, fallback]
    .map(value => value?.trim())
    .find(value => value !== undefined && value !== '');

  if (candidate === undefined) throw missingTimezone();
  if (!isValidTimezone(candidate)) throw invalidTimezone(candidate);

  return candidate;
}
