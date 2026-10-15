import hashRecord from 'object-hash';

function createKeyBuilder(): (value: unknown) => string {
  const identities = new Map<unknown, number>();
  const ancestors: object[] = [];

  function identityKey(value: unknown): string {
    if (!identities.has(value)) identities.set(value, identities.size);

    return `s${identities.get(value)}`;
  }

  function toKey(value: unknown): string {
    if (value === null) return 'z';
    if (value === undefined) return 'u';

    switch (typeof value) {
      case 'string':
        return JSON.stringify(value);
      case 'number':
        return Object.is(value, -0) ? 'n-0' : `n${value}`;
      case 'bigint':
        return `i${value}`;
      case 'boolean':
        return `b${value}`;
      case 'object':
        break;
      default:
        return identityKey(value);
    }

    if (value instanceof Date) return `D${value.getTime()}`;
    if (Buffer.isBuffer(value)) return `B${value.toString('base64')}`;

    const depth = ancestors.indexOf(value);
    if (depth !== -1) return `^${ancestors.length - depth}`;

    const prototype = Object.getPrototypeOf(value);
    let key: string;

    ancestors.push(value);

    if (Array.isArray(value)) {
      key = `[${Array.from(value, toKey).join(',')}]`;
    } else if (prototype === Object.prototype || prototype === null) {
      const entries = Object.entries(value).map(
        ([name, item]) => `${JSON.stringify(name)}:${toKey(item)}`,
      );
      key = `{${entries.join(',')}}`;
    } else {
      key = `h${hashRecord(value)}`;
    }

    ancestors.pop();

    return key;
  }

  return toKey;
}

export default async function transformUniqueValues<Input, Output>(
  inputs: Input[],
  callback: (inputs: Input[]) => Promise<Output[]>,
): Promise<Output[]> {
  const toKey = createKeyBuilder();
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
