import type { PlainField } from './types';
import type { File } from '@forestadmin/datasource-toolkit';

import { makeDataUri } from '@forestadmin/datasource-toolkit';

export function isFileType(type: PlainField['type']): boolean {
  return type === 'File';
}

export function isFileListType(type: PlainField['type']): boolean {
  return type === 'FileList' || (Array.isArray(type) && type[0] === 'File');
}

function isFile(value: unknown): value is File {
  const candidate = value as File;

  return (
    typeof value === 'object' &&
    Buffer.isBuffer(candidate.buffer) &&
    typeof candidate.mimeType === 'string'
  );
}

function encodeFileValue(value: unknown, fieldName: string): unknown {
  // Strings pass through untouched: an already encoded data uri stays byte-identical, and
  // callers that address the file indirectly (mcp-server upload handles) keep their sentinel.
  if (value === null || value === undefined || typeof value === 'string') return value;

  if (isFile(value)) return makeDataUri(value);

  throw new Error(
    `Field "${fieldName}" expects a file: pass { buffer, mimeType, name } ` +
      'or a string holding an already encoded data uri.',
  );
}

export default function encodeFileFieldValue(
  type: PlainField['type'],
  value: unknown,
  fieldName: string,
): unknown {
  if (isFileListType(type)) {
    return Array.isArray(value) ? value.map(item => encodeFileValue(item, fieldName)) : value;
  }

  if (isFileType(type)) return encodeFileValue(value, fieldName);

  return value;
}
