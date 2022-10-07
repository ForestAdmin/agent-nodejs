import { Readable } from 'stream';

export default async (generator: AsyncGenerator<string>) => {
  const csvResult = [];

  for await (const csv of Readable.from(generator) as Readable) {
    csvResult.push(csv);
  }

  return csvResult;
};
