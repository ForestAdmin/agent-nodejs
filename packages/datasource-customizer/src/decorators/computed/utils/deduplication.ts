import hashRecord from 'object-hash';

function toKey(value: unknown): string {
  if (value === null) return 'z';
  if (value === undefined) return 'u';

  switch (typeof value) {
    case 'string':
      return JSON.stringify(value);
    case 'number':
      return `n${value}`;
    case 'bigint':
      return `i${value}`;
    case 'boolean':
      return `b${value}`;
    case 'object':
      break;
    default:
      return `h${hashRecord(value as object)}`;
  }

  if (value instanceof Date) return `D${value.getTime()}`;
  if (Buffer.isBuffer(value)) return `B${value.toString('base64')}`;
  if (Array.isArray(value)) return `[${value.map(toKey).join(',')}]`;

  const prototype = Object.getPrototypeOf(value);

  if (prototype === Object.prototype || prototype === null) {
    const entries = Object.entries(value).map(
      ([key, item]) => `${JSON.stringify(key)}:${toKey(item)}`,
    );

    return `{${entries.join(',')}}`;
  }

  return `h${hashRecord(value)}`;
}

export default async function transformUniqueValues<Input, Output>(
  inputs: Input[],
  callback: (inputs: Input[]) => Promise<Output[]>,
): Promise<Output[]> {
  const indexes = new Map<string, number>();
  const mapping: number[] = [];
  const uniqueInputs: Input[] = [];

  for (const input of inputs) {
    if (input !== null) {
      const key = toKey(input);

      if (!indexes.has(key)) {
        indexes.set(key, uniqueInputs.length);
        uniqueInputs.push(input);
      }

      mapping.push(indexes.get(key));
    } else {
      mapping.push(-1);
    }
  }

  const uniqueOutputs = await callback(uniqueInputs);

  return mapping.map(index => (index !== -1 ? uniqueOutputs[index] : null));
}
