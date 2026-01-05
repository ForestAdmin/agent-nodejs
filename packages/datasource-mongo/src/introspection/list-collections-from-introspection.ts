import type { Introspection } from './types';

export default function listCollectionsFromIntrospection(introspection: Introspection): string[] {
  if (!introspection) {
    return [];
  }

  return introspection.models.map(model => model.name);
}
