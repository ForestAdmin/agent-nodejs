import Introspector from './introspector';
import { SupportedIntrospection } from './types';

export default function listCollectionsFromIntrospection(
  introspection: SupportedIntrospection,
): string[] {
  if (!introspection) {
    return [];
  }

  return Introspector.getIntrospectionInLatestFormat(introspection).tables.map(table => table.name);
}
