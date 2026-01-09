import { z } from 'zod';

/**
 * Creates a collection name schema that accepts any string but provides
 * available collection names as suggestions in the description.
 *
 * Unlike z.enum() which strictly validates against a list, this schema
 * allows any collection name to pass validation. This is useful when:
 * - The collection list might be incomplete
 * - We want to delegate validation to the actual API call
 * - We want to provide helpful suggestions without being restrictive
 */
export default function createCollectionNameSchema(collectionNames: string[]) {
  if (collectionNames.length > 0) {
    return z.string().describe(`Available collections: ${collectionNames.join(', ')}`);
  }

  return z.string();
}
