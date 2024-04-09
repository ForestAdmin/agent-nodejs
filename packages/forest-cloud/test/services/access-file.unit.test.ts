import path from 'path';

import { BusinessError } from '../../src/errors';
import { throwIfNoBuiltCode } from '../../src/services/access-file';

describe('access-file', () => {
  describe('throwIfNoBuiltCode', () => {
    it('should throw a BusinessError if no built code is found', async () => {
      const builtCodePath = path.resolve(__dirname, '__data__/customization/NON_EXISTING_PATH');

      await expect(throwIfNoBuiltCode(builtCodePath)).rejects.toThrow(
        new BusinessError(
          `No built customization found at ${builtCodePath}.\n` +
            'Please build your code to build your customizations',
        ),
      );
    });

    it('should resolve if built code is found', async () => {
      const builtCodePath = path.resolve(
        __dirname,
        '__data__/customization/exports/dist/code-customizations',
      );

      await expect(throwIfNoBuiltCode(builtCodePath)).resolves.toBeUndefined();
    });
  });
});
