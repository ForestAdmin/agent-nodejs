import makeServices from '../../src/services';
import * as factories from '../__factories__';

describe('Services', () => {
  const options = factories.forestAdminHttpDriverOptions.build();

  test('makeServices', () => {
    expect(() => makeServices(options)).not.toThrow();
  });
});
