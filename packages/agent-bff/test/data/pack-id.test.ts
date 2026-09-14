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

  it('should throw a 500 mapping error when a Number segment is not numeric', () => {
    expect(() => unpackPrimaryKey('abc', [{ name: 'id', type: 'Number' }])).toThrow(
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

  describe('when the record can say which segment belongs to which key', () => {
    it('should place the segments by value rather than by the order the apimap published', () => {
      expect(
        unpackPrimaryKey(
          'acme|42',
          [
            { name: 'seq', type: 'Number' },
            { name: 'tenant_id', type: 'String' },
          ],
          { tenantId: 'acme', seq: 42, id: 'acme|42' },
        ),
      ).toEqual({ seq: 42, tenant_id: 'acme' });
    });

    it('should read a key under its exact name when the record carries it unchanged', () => {
      expect(
        unpackPrimaryKey(
          'ab|7',
          [
            { name: 'orderId', type: 'Number' },
            { name: 'sku', type: 'String' },
          ],
          { orderId: 7, sku: 'ab' },
        ),
      ).toEqual({ orderId: 7, sku: 'ab' });
    });

    it('should give a key named id the leftover segment, since its attribute holds the packed id', () => {
      expect(
        unpackPrimaryKey(
          'acme|42',
          [
            { name: 'id', type: 'Number' },
            { name: 'tenant', type: 'String' },
          ],
          { tenant: 'acme', id: 'acme|42' },
        ),
      ).toEqual({ id: 42, tenant: 'acme' });
    });

    it('should keep the packed value, not the record value, once the segment is placed', () => {
      expect(
        unpackPrimaryKey(
          '042|acme',
          [
            { name: 'ref', type: 'String' },
            { name: 'tenant', type: 'String' },
          ],
          { ref: '042', tenant: 'acme' },
        ),
      ).toEqual({ ref: '042', tenant: 'acme' });
    });

    it.each([
      ['null', null],
      ['a boolean', false],
      ['a relation object', { id: 3 }],
      ['a buffer payload', { type: 'Buffer', data: [1, 2] }],
      ['an array', [1, 2]],
    ])('should ignore %s and fall back to the positional segment', (_, value) => {
      expect(
        unpackPrimaryKey(
          '7|ab',
          [
            { name: 'orderId', type: 'Number' },
            { name: 'sku', type: 'String' },
          ],
          { orderId: value, sku: 'ab' },
        ),
      ).toEqual({ orderId: 7, sku: 'ab' });
    });

    it('should fall back to the positional segments when no key matches', () => {
      expect(
        unpackPrimaryKey(
          '7|ab',
          [
            { name: 'orderId', type: 'Number' },
            { name: 'sku', type: 'String' },
          ],
          { createdAt: '2026-09-14T00:00:00.000Z' },
        ),
      ).toEqual({ orderId: 7, sku: 'ab' });
    });

    it('should still throw when a positionally assigned Number segment is not numeric', () => {
      expect(() =>
        unpackPrimaryKey(
          'acme|42',
          [
            { name: 'seq', type: 'Number' },
            { name: 'tenant_id', type: 'String' },
          ],
          {},
        ),
      ).toThrow(expect.objectContaining({ type: 'mapping_error', status: 500 }));
    });

    it('should leave a derived key whole, since its column was never declared', () => {
      expect(
        unpackPrimaryKey('tenant|42', [{ name: 'id', type: 'String', derived: true }], {
          id: 'tenant|42',
          tenant: 'tenant',
        }),
      ).toEqual({ id: 'tenant|42' });
    });

    it('should keep a single numeric key typed', () => {
      expect(unpackPrimaryKey('42', [{ name: 'id', type: 'Number' }], { id: '42' })).toEqual({
        id: 42,
      });
    });

    it('should assign one segment to a single key even when two keys share a value', () => {
      expect(
        unpackPrimaryKey(
          'acme|acme',
          [
            { name: 'tenant_id', type: 'String' },
            { name: 'owner_id', type: 'String' },
          ],
          { tenantId: 'acme', ownerId: 'acme' },
        ),
      ).toEqual({ tenant_id: 'acme', owner_id: 'acme' });
    });
  });

  describe('when the key was derived, so its arity is a guess', () => {
    it('should keep a packed composite id whole rather than 500 on the segment count', () => {
      expect(
        unpackPrimaryKey('tenant|42', [{ name: 'id', type: 'String', derived: true }]),
      ).toEqual({ id: 'tenant|42' });
    });

    it('should still type a numeric id, which the declared id field says is a Number', () => {
      expect(unpackPrimaryKey('42', [{ name: 'id', type: 'Number', derived: true }])).toEqual({
        id: 42,
      });
    });

    it('should leave a non-numeric id a string rather than throw on a Number field', () => {
      expect(unpackPrimaryKey('7|ab', [{ name: 'id', type: 'Number', derived: true }])).toEqual({
        id: '7|ab',
      });
    });

    // The derived key carries the agent id opaque, so a cast that loses anything names another
    // record. Every one of these round-trips back to different characters than `record.id` holds.
    it.each([
      ['an integer past the safe range', '9007199254740993'],
      ['a non-finite value', 'Infinity'],
      ['an exponent form', '1e3'],
      ['a leading zero', '042'],
      ['a fractional value', '42.5'],
    ])('should keep %s a string rather than cast it lossily', (_, packedId) => {
      expect(unpackPrimaryKey(packedId, [{ name: 'id', type: 'Number', derived: true }])).toEqual({
        id: packedId,
      });
    });
  });
});
