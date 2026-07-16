import { mapCountResponse, mapListResponse } from '../../src/data/response-mappers';

describe('mapListResponse', () => {
  it('should return flat records with __forest metadata and countStatus not_requested', () => {
    const result = mapListResponse(
      'users',
      [{ id: '42', email: 'user@example.com' }],
      [{ name: 'id', type: 'Number' }],
    );

    expect(result).toEqual({
      data: [
        {
          id: '42',
          email: 'user@example.com',
          __forest: { collection: 'users', primaryKey: { id: 42 } },
        },
      ],
      meta: { countStatus: 'not_requested' },
    });
  });

  it('should return the packed composite id unchanged and expose the structured primaryKey', () => {
    const result = mapListResponse(
      'orderLines',
      [{ id: '7|ab', label: 'Widget' }],
      [
        { name: 'orderId', type: 'Number' },
        { name: 'sku', type: 'String' },
      ],
    );

    expect(result.data[0]).toEqual(
      expect.objectContaining({
        id: '7|ab',
        __forest: { collection: 'orderLines', primaryKey: { orderId: 7, sku: 'ab' } },
      }),
    );
  });

  it('should throw a mapping error when a record has no id', () => {
    expect(() =>
      mapListResponse('users', [{ email: 'x' }], [{ name: 'id', type: 'Number' }]),
    ).toThrow(expect.objectContaining({ type: 'mapping_error', status: 500 }));
  });
});

describe('mapCountResponse', () => {
  it('should report available with the numeric count', () => {
    expect(mapCountResponse({ count: 42 })).toEqual({ count: 42, countStatus: 'available' });
  });

  it('should report available with zero for an active empty collection', () => {
    expect(mapCountResponse({ count: 0 })).toEqual({ count: 0, countStatus: 'available' });
  });

  it('should report deactivated from the raw meta marker', () => {
    expect(mapCountResponse({ meta: { count: 'deactivated' } })).toEqual({
      count: null,
      countStatus: 'deactivated',
    });
  });

  it('should throw a mapping error when neither a numeric count nor the marker is present', () => {
    expect(() => mapCountResponse({})).toThrow(
      expect.objectContaining({ type: 'mapping_error', status: 500 }),
    );
  });

  it('should not trust a NaN count from the lossy helper', () => {
    expect(() => mapCountResponse({ count: Number.NaN })).toThrow(
      expect.objectContaining({ type: 'mapping_error', status: 500 }),
    );
  });
});
