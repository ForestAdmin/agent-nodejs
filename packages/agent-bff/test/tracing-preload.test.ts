import initTracing from '../src/tracing';

jest.mock('../src/tracing', () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe('tracing-preload', () => {
  it('should arm tracing as soon as it is required, since --require is all that runs it', () => {
    jest.isolateModules(() => {
      // eslint-disable-next-line global-require
      require('../src/tracing-preload');
    });

    expect(initTracing).toHaveBeenCalledTimes(1);
    expect(initTracing).toHaveBeenCalledWith();
  });
});
