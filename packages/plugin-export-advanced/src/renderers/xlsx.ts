import type { Cell } from 'write-excel-file/node';

import writeXlsxFile from 'write-excel-file/node';

import getFieldValue from '../utils/get-field-value';

// Matches excel4node's default date format so exports stay identical after the migration.
const XLSX_DATE_FORMAT = 'm/d/yy';

export function toCell(value: unknown): Cell {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return { type: Boolean, value };

  if (typeof value === 'number') {
    return Number.isFinite(value)
      ? { type: Number, value }
      : { type: String, value: String(value) };
  }

  if (value instanceof Date) {
    return Number.isFinite(value.getTime())
      ? { type: Date, value, format: XLSX_DATE_FORMAT }
      : null;
  }

  if (typeof value === 'string') {
    if (value === 'true' || value === 'false') return { type: Boolean, value: value === 'true' };

    if (value.trim() !== '' && Number.isFinite(Number(value))) {
      return { type: Number, value: Number(value) };
    }

    const timestamp = Date.parse(value);

    if (!Number.isNaN(timestamp)) {
      return { type: Date, value: new Date(timestamp), format: XLSX_DATE_FORMAT };
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

  return writeXlsxFile([header, ...rows], { sheet: 'Export' }).toBuffer();
}
