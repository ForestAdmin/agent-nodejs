import type { File } from '../interfaces/action';

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

  // Without this the split below yields undefined data and Buffer.from raises an opaque
  // TypeError. Reachable from action values, which a model can populate freely.
  if (!dataUri.startsWith('data:')) {
    throw new Error(`Not a data uri: "${dataUri.slice(0, 32)}"`);
  }

  const [header, data] = dataUri.substring(5).split(',');
  const [mimeType, ...mediaTypes] = header.split(';');
  const result = { mimeType, buffer: Buffer.from(data, 'base64') };

  for (const mediaType of mediaTypes) {
    const index = mediaType.indexOf('=');

    if (index !== -1) {
      result[mediaType.substring(0, index)] = decodeURIComponent(mediaType.substring(index + 1));
    }
  }

  return result as File;
}
