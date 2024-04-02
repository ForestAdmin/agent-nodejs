import Introspector from './introspector';
import { LegacyIntrospection } from './types';

export default function listCollectionsFromIntrospection(
  introspection: LegacyIntrospection,
): string[] {
  if (!introspection) {
    return [];
  }

  return Introspector.getIntrospectionInLatestFormat(introspection).tables.map(table => table.name);
}
