import type { DataSourceDatabase } from '../interfaces/schema';

/** Longest database name reported, aligned with the server-side sanitizer. */
export const MAX_DATABASE_NAME_LENGTH = 128;

/** Builds one schema entry: the name is trimmed, and dropped when empty or over the cap. */
export function makeDatabaseEntry(type: string, name?: string | null): DataSourceDatabase {
  const trimmed = typeof name === 'string' ? name.trim() : null;

  return {
    type,
    name: trimmed && trimmed.length <= MAX_DATABASE_NAME_LENGTH ? trimmed : null,
  };
}
