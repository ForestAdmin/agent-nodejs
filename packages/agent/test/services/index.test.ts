import * as factories from '../__factories__';
import makeServices from '../../src/services';

describe('Services', () => {
  const options = factories.forestAdminHttpDriverOptions.build();

  test('makeServices', () => {
    expect(() => makeServices(options)).not.toThrow();
  });
});
