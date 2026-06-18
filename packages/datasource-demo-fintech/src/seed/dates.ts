// Demo dates are computed relative to the moment the data source is loaded, so a
// project bootstrapped with `forest create demo` always shows fresh, recent data
// — regardless of when it is run.

function shifted(days: number): Date {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);

  return date;
}

/** ISO timestamp `days` in the past (negative = future). */
export function daysAgo(days: number): string {
  return shifted(days).toISOString();
}

/** ISO timestamp `hours` in the past (negative = future). */
export function hoursAgo(hours: number): string {
  const date = new Date();
  date.setUTCHours(date.getUTCHours() - hours);

  return date.toISOString();
}

/** `YYYY-MM-DD` date-only string `days` in the past (negative = future). */
export function dayOnlyAgo(days: number): string {
  return shifted(days).toISOString().slice(0, 10);
}
