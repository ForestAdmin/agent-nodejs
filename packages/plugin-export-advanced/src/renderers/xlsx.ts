import xl from 'excel4node';
import { Readable } from 'stream';

import getFieldValue from '../utils/get-field-value';

function getExcel4NodeTypeFromValue(value: unknown): string {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return 'bool';
  if (typeof value === 'number') return 'number';

  if (typeof value === 'string') {
    if (value === 'true' || value === 'false') return 'bool';
    if (!Number.isNaN(Number(value))) return 'number';
    if (!Number.isNaN(Date.parse(value))) return 'date';

    return 'string';
  }

  if (value instanceof Date) return 'date';

  return 'string';
}

function castValue(value) {
  switch (getExcel4NodeTypeFromValue(value)) {
    case 'bool':
      return Boolean(value);
    case 'number':
      return Number(value);
    case 'string':
      return String(value);
    case 'date':
      return new Date(value);
    default:
      return String(value);
  }
}

export default function render(records: Record<string, unknown>[], projection: string[]): Readable {
  const wb = new xl.Workbook();
  const ws = wb.addWorksheet('Export');

  for (const [index, name] of projection.entries()) {
    ws.cell(1, index + 1).string(name);
  }

  for (const [row, record] of records.entries()) {
    for (const [col, name] of projection.entries()) {
      const value = getFieldValue(record, name);
      const castedValue = castValue(value);
      const excel4NodeCellFunction = getExcel4NodeTypeFromValue(castedValue);

      if (value !== null && value !== undefined) {
        ws.cell(2 + row, 1 + col)[excel4NodeCellFunction](castedValue);
      }
    }
  }

  return wb.writeToBuffer();
}
