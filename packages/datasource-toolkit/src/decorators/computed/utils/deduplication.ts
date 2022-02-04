import hashRecord from 'object-hash';

export default async function transformUniqueValues<Input, Output>(
  inputs: Input[],
  callback: (inputs: Input[]) => Promise<Output[]>,
): Promise<Output[]> {
  const indexes: Record<string, number> = {};
  const mapping: number[] = [];
  const uniqueInputs: Input[] = [];

  for (const input of inputs) {
    const hash = hashRecord(input);

    if (indexes[hash] === undefined) {
      indexes[hash] = uniqueInputs.length;
      uniqueInputs.push(input);
    }

    mapping.push(indexes[hash]);
  }

  const uniqueOutputs = await callback(uniqueInputs);

  return mapping.map(index => (index !== -1 ? uniqueOutputs[index] : undefined));
}
