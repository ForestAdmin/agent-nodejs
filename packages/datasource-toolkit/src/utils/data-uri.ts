import type { File } from '../interfaces/action';

import { ValidationError } from '../errors';

const METADATA_KEYS = ['name', 'charset'] as const;

export function isDataUri(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('data:');
}

export function makeDataUri(file: File): string {
  if (!file) return null;

  const { mimeType, buffer, ...mediaTypes } = file;
  const encoded = Object.entries(mediaTypes)
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}=${encodeURIComponent(value as string)}`)
    .join(';');

  const header = encoded ? `data:${mimeType};${encoded}` : `data:${mimeType}`;

  return `${header};base64,${buffer.toString('base64')}`;
}

// Hand-rolled rather than a spec-compliant parser: Forest carries the filename in a
// non-standard `name=` media type that RFC 2397 does not define, and spec parsers drop it.
export function parseDataUri(dataUri: string): File {
  if (!dataUri) return null;

  // Everything below is reachable from an action value, which a model populates freely, and every
  // raw failure here is opaque: no comma makes Buffer.from raise a TypeError, and a lone '%' in a
  // media type makes decodeURIComponent raise a URIError. Both surface as a generic 500, so the
  // caller never learns what to send instead.
  const malformed = () =>
    new ValidationError(
      `Expected a file, got "${dataUri.slice(0, 32)}". A file value must be a data uri.`,
    );

  if (!dataUri.startsWith('data:') || !dataUri.includes(',')) throw malformed();

  const [header, data] = dataUri.substring(5).split(',');
  const [mimeType, ...mediaTypes] = header.split(';');

  // Buffer.from(x, 'base64') never throws: it skips what it cannot read and stops at padding. So a
  // uri whose payload is not base64 at all — `data:text/plain,hello` — would decode to plausible
  // garbage and reach the end user as a corrupt file, reported as a success.
  if (!mediaTypes.includes('base64')) throw malformed();

  const result = { mimeType, buffer: Buffer.from(data, 'base64') };

  for (const mediaType of mediaTypes) {
    const index = mediaType.indexOf('=');
    const key = index === -1 ? '' : mediaType.substring(0, index);

    // Assigning any key would let "buffer=oops" replace the decoded bytes with a string, or
    // "mimeType=..." contradict the header. Only the metadata Forest carries is read back.
    if (METADATA_KEYS.includes(key as (typeof METADATA_KEYS)[number])) {
      try {
        result[key] = decodeURIComponent(mediaType.substring(index + 1));
      } catch {
        throw malformed();
      }
    }
  }

  return result as File;
}
