import type { RecordId } from './types';

// Forest Admin backend expects composite PKs pipe-joined (e.g. "k1|k2"). Centralizing the
// encoding here lets callers pass structured arrays and keeps the convention out of their code.
// Throws rather than silently corrupting the key when parts are nullish or contain the "|"
// separator — either case would produce a malformed id that could match the wrong record.
export default function encodeRecordId(id: RecordId): string {
  if (!Array.isArray(id)) return String(id);
  if (id.length === 0) throw new Error('Composite record id cannot be empty');

  return id
    .map(part => {
      if (part === null || part === undefined) {
        throw new Error('Composite record id parts cannot be null or undefined');
      }

      const serialized = String(part);

      if (serialized.includes('|')) {
        throw new Error(
          `Composite record id part "${serialized}" cannot contain the "|" separator`,
        );
      }

      return serialized;
    })
    .join('|');
}
