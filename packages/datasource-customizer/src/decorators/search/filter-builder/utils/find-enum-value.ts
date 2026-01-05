import type { ColumnSchema } from '@forestadmin/datasource-toolkit';

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export default function findEnumValue(value: string, schema: ColumnSchema): string | null {
  const haystack = schema.enumValues || [];
  const needle = normalize(value || '');

  return haystack?.find(v => normalize(v) === needle) || null;
}
