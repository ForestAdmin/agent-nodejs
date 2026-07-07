import unpackPrimaryKey from '../../src/data/pack-id';

describe('unpackPrimaryKey', () => {
  it('should build a single numeric key from the packed id', () => {
    expect(unpackPrimaryKey('42', [{ name: 'id', type: 'Number' }])).toEqual({ id: 42 });
  });

  it('should keep a non-Number key as a string', () => {
    expect(unpackPrimaryKey('a1b2', [{ name: 'uuid', type: 'Uuid' }])).toEqual({ uuid: 'a1b2' });
  });

  it('should build a composite key casting each segment by its type', () => {
    expect(
      unpackPrimaryKey('7|ab', [
        { name: 'orderId', type: 'Number' },
        { name: 'sku', type: 'String' },
      ]),
    ).toEqual({ orderId: 7, sku: 'ab' });
  });

  it('should throw a 500 mapping error when the collection exposes no key metadata', () => {
    expect(() => unpackPrimaryKey('42', [])).toThrow(
      expect.objectContaining({ type: 'mapping_error', status: 500 }),
    );
  });

  it('should throw a 500 mapping error when segment count does not match the keys', () => {
    expect(() =>
      unpackPrimaryKey('7', [
        { name: 'orderId', type: 'Number' },
        { name: 'sku', type: 'String' },
      ]),
    ).toThrow(expect.objectContaining({ type: 'mapping_error', status: 500 }));
  });
});
