import index from '../src/index';

describe('index', () => {
  it('should export a string', () => {
    expect(index).toStrictEqual('New Package');
  });
});
