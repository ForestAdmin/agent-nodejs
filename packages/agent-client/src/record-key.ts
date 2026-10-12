import Inflector from 'inflected';

/**
 * The key a field really carries in a response record. `agent-client` deserializes the agent's
 * JSON:API with `keyForAttribute: 'camelCase'` (`http-requester.ts`), which is exactly this pair of
 * `inflected` calls (`jsonapi-serializer/lib/inflector.js`), so a `first_name` column is PROJECTED
 * under that name and RETURNED as `firstName`. The same library rather than a transcription: the
 * transform handles acronyms and non-ASCII, and a mirror would drift from the deserializer without
 * anything failing.
 */
export default function recordKey(field: string): string {
  return Inflector.camelize(Inflector.underscore(field), false);
}

/**
 * The same names grouped by the key they reach the response under. A group of more than one is the
 * transform being lossy: those names collapse onto one key and which of them it holds is not
 * knowable from here.
 */
export function groupByRecordKey<T>(
  items: readonly T[],
  name: (item: T) => string,
): Map<string, T[]> {
  const byKey = new Map<string, T[]>();

  for (const item of items) {
    const key = recordKey(name(item));
    const group = byKey.get(key);

    if (group) group.push(item);
    else byKey.set(key, [item]);
  }

  return byKey;
}

const RESOURCE_ID_KEY = 'id';

export interface PublishedRecordKey {
  recordKey: string | null;
  sharesRecordKeyWith?: string[];
}

export function publishedRecordKeys(
  namesOfEveryField: readonly string[],
): Map<string, PublishedRecordKey> {
  const published = new Map<string, PublishedRecordKey>();

  for (const [key, group] of groupByRecordKey(namesOfEveryField, name => name)) {
    const names = [...new Set(group)];

    if (key === RESOURCE_ID_KEY) {
      names
        .filter(name => name !== RESOURCE_ID_KEY)
        .forEach(name => published.set(name, { recordKey: null }));
    } else if (names.length > 1) {
      names.forEach(name =>
        published.set(name, {
          recordKey: key,
          sharesRecordKeyWith: names.filter(other => other !== name),
        }),
      );
    } else if (key !== names[0]) {
      published.set(names[0], { recordKey: key });
    }
  }

  return published;
}
