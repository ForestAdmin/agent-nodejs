import type { Cell } from 'write-excel-file/node';

import writeXlsxFile from 'write-excel-file/node';

import getFieldValue from '../utils/get-field-value';

export function toCell(value: unknown): Cell {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return { type: Boolean, value };
  if (typeof value === 'number') return { type: Number, value };
  if (value instanceof Date) return { type: Date, value, format: 'yyyy-mm-dd hh:mm:ss' };

  if (typeof value === 'string') {
    if (value === 'true' || value === 'false') return { type: Boolean, value: value === 'true' };

    if (value.trim() !== '' && !Number.isNaN(Number(value))) {
      return { type: Number, value: Number(value) };
    }

    const timestamp = Date.parse(value);

    if (!Number.isNaN(timestamp)) {
      return { type: Date, value: new Date(timestamp), format: 'yyyy-mm-dd hh:mm:ss' };
    }

    return { type: String, value };
  }

  return { type: String, value: String(value) };
}

export default function render(
  records: Record<string, unknown>[],
  projection: string[],
): Promise<Buffer> {
  const header: Cell[] = projection.map(name => ({ type: String, value: name }));
  const rows = records.map(record => projection.map(name => toCell(getFieldValue(record, name))));

  return writeXlsxFile([header, ...rows]).toBuffer();
}
