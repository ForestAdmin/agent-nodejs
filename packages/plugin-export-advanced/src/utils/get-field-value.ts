export default function getFieldValue(record: unknown, field: string): unknown {
  const path = field.split(':');
  let current = record;
  while (path.length && current) current = current[path.shift()];

  return path.length === 0 ? current : undefined;
}
