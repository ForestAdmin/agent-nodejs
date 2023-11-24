/**
 * "ENUM('enum1','enum2')" returns ['enum1', 'enum2']]
 */
export default function parseEnum(type: string | null): string[] {
  if (!type?.startsWith('ENUM(')) return null;

  const values = type.slice(5, -1);

  let buffer = '';
  let isInValue = false;
  const list = [];

  for (let i = 0; i < values.length; i += 1) {
    const currentChar = values[i];

    if (currentChar === "'") {
      if (!isInValue) {
        isInValue = true;
      } else if (values[i + 1] === "'") {
        buffer += "'";
        i += 1;
      } else {
        isInValue = false;
      }
    } else if (currentChar === '\\') {
      buffer += values[i + 1];
      i += 1;
    } else if (!isInValue && currentChar === ',') {
      list.push(buffer);
      buffer = '';
    } else {
      buffer += currentChar;
    }
  }

  if (buffer.length) list.push(buffer);

  return list;
}
