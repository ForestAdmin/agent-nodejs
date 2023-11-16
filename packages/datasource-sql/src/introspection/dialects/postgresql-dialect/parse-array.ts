import { buffer } from 'stream/consumers';

export default function parseArray(value: string | null): string[] {
  if (!value?.length || !value.startsWith('{') || !value.endsWith('}')) return null;

  const values = value.slice(1, -1);

  const list = [];
  let isInValue = false;
  let buffer = '';

  for (let i = 0; i < values.length; i += 1) {
    const currentChar = values[i];

    if (currentChar === '\\') {
      buffer += values[i + 1];
      i += 1;
      continue;
    }

    if (currentChar === "'" && values[i + 1] === "'") {
      buffer += "'";
      i += 1;
      continue;
    }

    if (currentChar === '"') {
      if (isInValue) {
        isInValue = false;
        continue;
      } else {
        isInValue = true;
        continue;
      }
    }

    if (currentChar === ',' && !isInValue) {
      list.push(buffer);
      buffer = '';
    } else {
      buffer += currentChar;
    }
  }

  if (buffer.length) list.push(buffer);

  return list;
}
