import makeServices from '../../src/services';

describe('Services', () => {
  const options = {
    envSecret: 'envSecret',
    forestServerUrl: 'https://api.url',
    prefix: '/forest',
  };

  test('makeServices', () => {
    expect(() => makeServices(options)).not.toThrow();
  });
});
