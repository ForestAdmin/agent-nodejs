import { IANAZone } from 'luxon';

// Every executor instance must read a relative date the same way, so the machine's zone is never the
// fallback. A zone the agent would reject is treated as an absent one: it answers 400 on an unknown
// zone, which would fail every read of every sweep of that inbox.
export default function toProjectTimezone(timezone: string | null | undefined): string {
  return timezone && IANAZone.isValidZone(timezone) ? timezone : 'UTC';
}
