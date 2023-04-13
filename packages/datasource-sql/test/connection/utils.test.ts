import { rewriteSequelizeErrors } from '../../src/connection/utils';

describe('utils', () => {
  it('rewriteSequelizeErrors should not rewrite unknown errors', () => {
    const error = new Error('Unknown error');
    expect(() => rewriteSequelizeErrors(error)).toThrow(error);
  });
});
