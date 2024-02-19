import fs from 'fs/promises';

import { BusinessError } from '../errors';

// eslint-disable-next-line import/prefer-default-export
export async function throwIfNoBuiltCode(path: string) {
  try {
    await fs.access(path);
  } catch (e) {
    throw new BusinessError(
      `No built customization found at ${path}.\n` +
        'Please build your code to build your customizations',
    );
  }
}
