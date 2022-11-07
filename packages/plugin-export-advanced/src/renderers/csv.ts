import getFieldValue from '../utils/get-field-value';

function escape(value: unknown): string {
  const str = value !== null && value !== undefined ? String(value) : '';

  return str.includes(',') ? `"${str.replace('\\', '\\\\').replace('"', '\\"')}"` : str;
}

export default function render(records: Record<string, unknown>[], projection: string[]): string {
  return [
    projection.map(p => escape(p)).join(','),
    ...records.map(r => projection.map(p => escape(getFieldValue(r, p))).join(',')),
  ].join('\n');
}
