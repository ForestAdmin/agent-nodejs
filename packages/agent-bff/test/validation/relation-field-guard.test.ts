import { type BffHttpError, toErrorBody } from '../../src/http/bff-http-error';
import assertNoRelationFieldPaths from '../../src/validation/relation-field-guard';

function captureError(fn: () => void): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }

  throw new Error('expected to throw');
}

describe('assertNoRelationFieldPaths', () => {
  it('rejects a nested relation path from a list projection', () => {
    expect(() => assertNoRelationFieldPaths(['id', 'company:name'])).toThrow(
      expect.objectContaining({
        type: 'relation_field_not_supported',
        status: 422,
        details: { fields: ['company:name'] },
      }),
    );
  });

  it('rejects a nested relation path from a list filter field', () => {
    expect(() => assertNoRelationFieldPaths(['owner:email'])).toThrow(
      expect.objectContaining({
        type: 'relation_field_not_supported',
        status: 422,
        details: { fields: ['owner:email'] },
      }),
    );
  });

  it('rejects a nested relation path from a list sort field', () => {
    expect(() => assertNoRelationFieldPaths(['company:createdAt'])).toThrow(
      expect.objectContaining({
        type: 'relation_field_not_supported',
        status: 422,
        details: { fields: ['company:createdAt'] },
      }),
    );
  });

  it('rejects a nested relation path from a count filter field', () => {
    expect(() => assertNoRelationFieldPaths(['status', 'company:tier'])).toThrow(
      expect.objectContaining({
        type: 'relation_field_not_supported',
        status: 422,
        details: { fields: ['company:tier'] },
      }),
    );
  });

  it('lists every offending path when several are present', () => {
    expect(() =>
      assertNoRelationFieldPaths(['id', 'company:name', 'title', 'owner:email']),
    ).toThrow(
      expect.objectContaining({
        details: { fields: ['company:name', 'owner:email'] },
      }),
    );
  });

  it('reports a single offending path as an array of length 1', () => {
    const error = captureError(() => assertNoRelationFieldPaths(['company:name']));

    expect((error as BffHttpError).details).toEqual({ fields: ['company:name'] });
  });

  it('dedupes an offending path seen on two surfaces, keeping first-seen order', () => {
    expect(() =>
      assertNoRelationFieldPaths(['company:name', 'id', 'company:name', 'owner:email']),
    ).toThrow(
      expect.objectContaining({
        details: { fields: ['company:name', 'owner:email'] },
      }),
    );
  });

  it('passes through direct field paths unchanged', () => {
    expect(() => assertNoRelationFieldPaths(['id', 'title', 'createdAt'])).not.toThrow();
  });

  it('passes through an empty path list', () => {
    expect(() => assertNoRelationFieldPaths([])).not.toThrow();
  });

  it('serializes to the wire error envelope with details.fields as an array', () => {
    const error = captureError(() => assertNoRelationFieldPaths(['company:name', 'owner:email']));

    expect(toErrorBody(error as BffHttpError)).toEqual({
      error: {
        type: 'relation_field_not_supported',
        status: 422,
        message: 'Nested relation field paths are not supported on top-level list and count',
        details: { fields: ['company:name', 'owner:email'] },
      },
    });
  });
});
