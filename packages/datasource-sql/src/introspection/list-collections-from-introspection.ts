import Introspector from './introspector';
import { SupportedIntrospection } from './types';

export default function listCollectionsFromIntrospection(
  introspection: SupportedIntrospection,
): string[] {
  if (!introspection) {
    return [];
  }

  const introspectionLatestFormat = Introspector.getIntrospectionInLatestFormat(introspection);

  return [...introspectionLatestFormat.tables, ...introspectionLatestFormat.views].map(
    tableOrView => tableOrView.name,
  );
}
