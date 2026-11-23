const DEACTIVATED = 'deactivated';

type CountResponse = { count?: unknown; meta?: { count?: unknown } } | null | undefined;

export default function toCount(response: CountResponse): number | null {
  if (response?.meta?.count === DEACTIVATED) return null;

  return Number(response?.count ?? NaN);
}
