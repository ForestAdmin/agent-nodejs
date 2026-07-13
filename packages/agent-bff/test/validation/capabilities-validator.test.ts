import type { CapabilitiesResult } from '../../src/read-model/capabilities-cache';

import { toErrorBody } from '../../src/http/bff-http-error';
import {
  assertValidAgainstCapabilities,
  validateAgainstCapabilities,
} from '../../src/validation/capabilities-validator';

const capabilities: CapabilitiesResult = {
  fields: [
    { name: 'id', type: 'Number', operators: ['equal', 'in', 'greater_than'] },
    { name: 'title', type: 'String', operators: ['equal', 'contains', 'i_contains'] },
    { name: 'internalCode', type: 'String', operators: [] },
    { name: 'author', type: 'ManyToOne' },
  ],
};

function captureError(fn: () => void): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }

  throw new Error('expected to throw');
}

describe('validateAgainstCapabilities', () => {
  describe('filter', () => {
    it('rejects a leaf on a field absent from capabilities', () => {
      const errors = validateAgainstCapabilities(
        { filter: { field: 'missing', operator: 'Equal', value: 1 } },
        capabilities,
      );

      expect(errors).toHaveLength(1);
      expect(errors[0]).toEqual(
        expect.objectContaining({ type: 'unknown_field', status: 422, details: { field: 'missing' } }),
      );
    });

    it('rejects a leaf nested under an And/Or group', () => {
      const errors = validateAgainstCapabilities(
        {
          filter: {
            aggregator: 'And',
            conditions: [
              { field: 'id', operator: 'Equal', value: 1 },
              { aggregator: 'Or', conditions: [{ field: 'missing', operator: 'Equal', value: 2 }] },
            ],
          },
        },
        capabilities,
      );

      expect(errors[0]).toEqual(
        expect.objectContaining({ type: 'unknown_field', details: { field: 'missing' } }),
      );
    });

    it('rejects a leaf on a field present with an empty operators array', () => {
      const errors = validateAgainstCapabilities(
        { filter: { field: 'internalCode', operator: 'Equal', value: 'x' } },
        capabilities,
      );

      expect(errors[0]).toEqual(
        expect.objectContaining({
          type: 'field_not_filterable',
          status: 422,
          details: { field: 'internalCode' },
        }),
      );
    });

    it('treats a relation field with no operators key as not filterable', () => {
      const errors = validateAgainstCapabilities(
        { filter: { field: 'author', operator: 'Equal', value: 1 } },
        capabilities,
      );

      expect(errors[0]).toEqual(
        expect.objectContaining({ type: 'field_not_filterable', details: { field: 'author' } }),
      );
    });

    it('rejects an operator not in the field normalized operators, listing validOperators', () => {
      const errors = validateAgainstCapabilities(
        { filter: { field: 'title', operator: 'StartsWith', value: 'a' } },
        capabilities,
      );

      expect(errors[0]).toEqual(
        expect.objectContaining({
          type: 'invalid_filter_operator',
          status: 400,
          details: { field: 'title', validOperators: ['Equal', 'Contains', 'IContains'] },
        }),
      );
    });

    it('accepts an operator supported by the field', () => {
      expect(
        validateAgainstCapabilities(
          { filter: { field: 'title', operator: 'IContains', value: 'a' } },
          capabilities,
        ),
      ).toEqual([]);
    });

    it('throws a 500 mapping_error when a capabilities operator does not normalize', () => {
      const error = captureError(() =>
        validateAgainstCapabilities(
          { filter: { field: 'weird', operator: 'Equal', value: 1 } },
          { fields: [{ name: 'weird', type: 'String', operators: ['made_up_operator'] }] },
        ),
      );

      expect(error).toEqual(expect.objectContaining({ type: 'mapping_error', status: 500 }));
    });
  });

  describe('sort and projection', () => {
    it('rejects an unknown sort field', () => {
      const errors = validateAgainstCapabilities({ sortFields: ['ghost'] }, capabilities);

      expect(errors[0]).toEqual(
        expect.objectContaining({ type: 'unknown_field', status: 422, details: { field: 'ghost' } }),
      );
    });

    it('rejects an unknown projection field', () => {
      const errors = validateAgainstCapabilities({ projectionFields: ['ghost'] }, capabilities);

      expect(errors[0]).toEqual(
        expect.objectContaining({ type: 'unknown_field', status: 422, details: { field: 'ghost' } }),
      );
    });

    it('accepts a non-filterable field for sort and projection existence checks', () => {
      expect(
        validateAgainstCapabilities(
          { sortFields: ['internalCode'], projectionFields: ['author'] },
          capabilities,
        ),
      ).toEqual([]);
    });
  });

  it('passes a fully valid filter, sort, and projection', () => {
    expect(
      validateAgainstCapabilities(
        {
          filter: { field: 'id', operator: 'GreaterThan', value: 1 },
          sortFields: ['title'],
          projectionFields: ['id', 'title'],
        },
        capabilities,
      ),
    ).toEqual([]);
  });

  it('rejects a projection field absent from capabilities, consulting no type table', () => {
    const errors = validateAgainstCapabilities({ projectionFields: ['description'] }, capabilities);

    expect(errors[0]).toEqual(
      expect.objectContaining({ type: 'unknown_field', details: { field: 'description' } }),
    );
  });

  it('reports every offending field in order and dedupes a field seen twice', () => {
    const errors = validateAgainstCapabilities(
      {
        filter: { field: 'foo', operator: 'Equal', value: 1 },
        sortFields: ['bar'],
        projectionFields: ['bar', 'baz'],
      },
      capabilities,
    );

    expect(errors.map(e => (e.details as { field: string }).field)).toEqual(['foo', 'bar', 'baz']);
  });

  it('serializes an error to the wire envelope', () => {
    const [error] = validateAgainstCapabilities({ sortFields: ['ghost'] }, capabilities);

    expect(toErrorBody(error)).toEqual({
      error: { type: 'unknown_field', status: 422, message: 'Unknown field: ghost', details: { field: 'ghost' } },
    });
  });
});

describe('assertValidAgainstCapabilities', () => {
  it('throws the first error', () => {
    expect(() =>
      assertValidAgainstCapabilities({ sortFields: ['ghost'] }, capabilities),
    ).toThrow(expect.objectContaining({ type: 'unknown_field', details: { field: 'ghost' } }));
  });

  it('does not throw for a valid request', () => {
    expect(() =>
      assertValidAgainstCapabilities({ projectionFields: ['id'] }, capabilities),
    ).not.toThrow();
  });
});
