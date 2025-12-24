import type { SupportedIntrospection } from './types';

import Introspector from './introspector';

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
