import { Introspection } from './types';

export default function listCollectionsFromIntrospection(
  introspection: Introspection | Introspection['tables'],
): string[] {
  if (!introspection) {
    return [];
  }

  // Support the previous format of introspection
  const tables = Array.isArray(introspection) ? introspection : introspection.tables;

  return tables.map(table => table.name);
}
