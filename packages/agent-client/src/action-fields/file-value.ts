import type { File } from '@forestadmin/datasource-toolkit';

import { makeDataUri } from '@forestadmin/datasource-toolkit';

import { InvalidActionFileValueError } from '../errors';

function isFileType(type: string): boolean {
  return type === 'File';
}

function isFileListType(type: string): boolean {
  return type === 'FileList';
}

function isFile(value: unknown): value is File {
  const candidate = value as File;

  return (
    typeof value === 'object' &&
    value !== null &&
    Buffer.isBuffer(candidate.buffer) &&
    typeof candidate.mimeType === 'string' &&
    typeof candidate.name === 'string'
  );
}

function fileError(fieldName: string, detail: string): Error {
  return new InvalidActionFileValueError(`Field "${fieldName}" ${detail}`);
}

function encodeFileValue(value: unknown, fieldName: string): string | null | undefined {
  if (value === null) return null;

  if (value === undefined) return undefined;

  // Callers that address the file indirectly (mcp-server upload handles) keep their sentinel:
  // validating strings here would break them, and the agent owns the final validation.
  if (typeof value === 'string') return value;

  if (isFile(value)) return makeDataUri(value);

  throw fileError(
    fieldName,
    'expects a file: pass { buffer, mimeType, name } or a string holding a data uri.',
  );
}

export type EncodedFileValue = string | null | undefined;

export default function encodeFileFieldValue<T>(
  type: string,
  value: T,
  fieldName: string,
): T | EncodedFileValue | EncodedFileValue[] {
  if (isFileListType(type)) {
    if (value === null || value === undefined) return value;

    if (!Array.isArray(value)) {
      throw fileError(fieldName, 'expects a list of files: pass an array.');
    }

    return value.map(item => encodeFileValue(item, fieldName));
  }

  if (isFileType(type)) return encodeFileValue(value, fieldName);

  // A file reaching a field that is not declared as one is never intentional, and it would be
  // JSON-serialized into the column as {"buffer":{"type":"Buffer",...}} without any error.
  if (isFile(value)) {
    throw fileError(
      fieldName,
      `takes ${type}, not a file: send the file to a File field instead. If this field is ` +
        'meant to take one, the action must declare it as type File or carry the ' +
        '"file picker" widget.',
    );
  }

  return value;
}
