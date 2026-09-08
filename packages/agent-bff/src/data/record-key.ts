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
