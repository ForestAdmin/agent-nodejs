import { handleSequelizeError } from '../../src/connection/utils';

describe('utils', () => {
  it('handleSequelizeError should not rewrite unknown errors', () => {
    const error = new Error('Unknown error');
    expect(() => handleSequelizeError(error)).toThrow(error);
  });
});
