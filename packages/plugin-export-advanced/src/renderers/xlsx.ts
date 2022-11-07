import xl from 'excel4node';
import { Readable } from 'stream';

import getFieldValue from '../utils/get-field-value';

export default function render(records: Record<string, unknown>[], projection: string[]): Readable {
  const wb = new xl.Workbook();
  const ws = wb.addWorksheet('Export');

  for (const [index, name] of projection.entries()) {
    ws.cell(1, index + 1).string(name);
  }

  for (const [row, record] of records.entries()) {
    for (const [col, name] of projection.entries()) {
      const value = getFieldValue(record, name);

      if (value !== null && value !== undefined) {
        ws.cell(2 + row, 1 + col).string(String(value));
      }
    }
  }

  return wb.writeToBuffer();
}
