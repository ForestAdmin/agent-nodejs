import { IANAZone } from 'luxon';

export default function toProjectTimezone(timezone: string | null | undefined): string {
  return timezone && IANAZone.isValidZone(timezone) ? timezone : 'UTC';
}
