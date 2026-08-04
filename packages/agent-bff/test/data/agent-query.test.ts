import {
  MAX_PARSED_FILTER_DEPTH,
  buildCountAgentQuery,
  buildListAgentQuery,
  collectCountFieldPaths,
  collectListFieldPaths,
  parseCountRequest,
  parseListRequest,
  parseParentId,
  parseRelationCountRequest,
  parseRelationListRequest,
} from '../../src/data/agent-query';

describe('buildListAgentQuery', () => {
  it('should always pass the resolved timezone', () => {
    expect(buildListAgentQuery('users', 'America/New_York', {})).toEqual({
      timezone: 'America/New_York',
    });
  });

  it('should serialize filter, projection, sort and page to agent query params', () => {
    const query = buildListAgentQuery('users', 'Europe/Paris', {
      filter: { field: 'email', operator: 'present' },
      projection: ['id', 'email'],
      sort: [{ field: 'createdAt', direction: 'desc' }],
      page: { limit: 20, offset: 40 },
    });

    expect(query).toEqual({
      timezone: 'Europe/Paris',
      filters: JSON.stringify({ field: 'email', operator: 'present' }),
      'fields[users]': 'id,email',
      sort: '-createdAt',
      'page[size]': 20,
      'page[number]': 3,
    });
  });

  it('should default an unspecified sort direction to ascending', () => {
    const query = buildListAgentQuery('users', 'Europe/Paris', {
      sort: [{ field: 'name' }, { field: 'age', direction: 'desc' }],
    });

    expect(query.sort).toBe('name,-age');
  });

  it('should reject an offset that is not a multiple of the limit', () => {
    expect(() =>
      buildListAgentQuery('users', 'Europe/Paris', { page: { limit: 20, offset: 15 } }),
    ).toThrow(expect.objectContaining({ type: 'invalid_request', status: 400 }));
  });
});

describe('buildCountAgentQuery', () => {
  it('should serialize only the filter and timezone', () => {
    expect(
      buildCountAgentQuery('Europe/Paris', { filter: { field: 'active', operator: 'equal' } }),
    ).toEqual({
      timezone: 'Europe/Paris',
      filters: JSON.stringify({ field: 'active', operator: 'equal' }),
    });
  });

  it('should emit only the timezone when no filter is provided', () => {
    expect(buildCountAgentQuery('UTC', {})).toEqual({ timezone: 'UTC' });
  });
});

describe('collectListFieldPaths', () => {
  it('should collect field paths from projection, filter and sort', () => {
    const paths = collectListFieldPaths({
      projection: ['id', 'company:name'],
      filter: {
        aggregator: 'and',
        conditions: [
          { field: 'email', operator: 'present' },
          { field: 'owner:email', operator: 'present' },
        ],
      },
      sort: [{ field: 'author:name', direction: 'asc' }],
    });

    expect(paths).toEqual(['id', 'company:name', 'email', 'owner:email', 'author:name']);
  });
});

describe('parseListRequest', () => {
  it('should accept a well-formed body', () => {
    const body = {
      filter: { field: 'email', operator: 'present' },
      projection: ['id'],
      sort: [{ field: 'createdAt', direction: 'desc' }],
      page: { limit: 10, offset: 0 },
    };

    expect(parseListRequest(body)).toBe(body);
  });

  it.each([
    ['a non-object body', 'nope'],
    ['a string projection', { projection: 'id' }],
    ['a non-string projection entry', { projection: [1] }],
    ['a string sort', { sort: 'createdAt' }],
    ['a sort clause without a field', { sort: [{ direction: 'asc' }] }],
    ['an invalid sort direction', { sort: [{ field: 'a', direction: 'up' }] }],
    ['a string filter', { filter: 'id' }],
    ['a string page', { page: '10' }],
    ['a non-positive page.limit', { page: { limit: 0, offset: 0 } }],
    ['a non-integer page.limit', { page: { limit: 2.5, offset: 0 } }],
    ['a negative page.offset', { page: { limit: 10, offset: -10 } }],
  ])('should reject %s with 400 invalid_request', (_label, body) => {
    expect(() => parseListRequest(body)).toThrow(
      expect.objectContaining({ type: 'invalid_request', status: 400 }),
    );
  });
});

describe('parseCountRequest', () => {
  it('should reject a string filter with 400 invalid_request', () => {
    expect(() => parseCountRequest({ filter: 'id' })).toThrow(
      expect.objectContaining({ type: 'invalid_request', status: 400 }),
    );
  });

  it.each([
    ['null', null],
    ['a string', 'foo'],
    ['an array', []],
  ])('should reject a non-object body (%s) with 400 invalid_request', (_label, body) => {
    expect(() => parseCountRequest(body)).toThrow(
      expect.objectContaining({ type: 'invalid_request', status: 400 }),
    );
  });
});

describe('a filter node readable as both a leaf and a branch', () => {
  const READABLE_AS_BOTH = {
    field: 'publisher:secretRevenue',
    operator: 'Equal',
    value: 1,
    conditions: [],
  };

  it.each([
    ['parseListRequest', parseListRequest],
    ['parseCountRequest', parseCountRequest],
  ])('should reject it in %s with 400 invalid_request', (_label, parse) => {
    expect(() => parse({ filter: READABLE_AS_BOTH })).toThrow(
      expect.objectContaining({ type: 'invalid_request', status: 400 }),
    );
  });

  it('should reject it nested inside a legitimate branch', () => {
    expect(() =>
      parseListRequest({ filter: { aggregator: 'And', conditions: [READABLE_AS_BOTH] } }),
    ).toThrow(expect.objectContaining({ type: 'invalid_request', status: 400 }));
  });

  it('should be invisible to the field-path collector', () => {
    expect(collectCountFieldPaths({ filter: READABLE_AS_BOTH })).toEqual([]);
  });

  it('should still accept a plain leaf and a plain branch', () => {
    const leaf = { field: 'title', operator: 'Present' };

    expect(() => parseCountRequest({ filter: leaf })).not.toThrow();
    expect(() =>
      parseListRequest({ filter: { aggregator: 'And', conditions: [leaf] } }),
    ).not.toThrow();
  });

  it('should reject a filter nested past the depth cap with 400 rather than blowing the stack', () => {
    let filter: unknown = { field: 'title', operator: 'Present' };

    for (let i = 0; i <= MAX_PARSED_FILTER_DEPTH; i += 1) {
      filter = { aggregator: 'And', conditions: [filter] };
    }

    expect(() => parseCountRequest({ filter })).toThrow(
      expect.objectContaining({
        type: 'filter_too_deep',
        status: 400,
        details: { maxDepth: MAX_PARSED_FILTER_DEPTH },
      }),
    );
  });
});

describe('parseParentId', () => {
  it('should return a non-empty string unchanged, including a composite packed id', () => {
    expect(parseParentId('a|b')).toBe('a|b');
    expect(parseParentId('550e8400-e29b-41d4-a716-446655440000')).toBe(
      '550e8400-e29b-41d4-a716-446655440000',
    );
  });

  it('should coerce a finite number to a string', () => {
    expect(parseParentId(42)).toBe('42');
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['empty string', ''],
    ['whitespace', '   '],
    ['object', {}],
    ['array', []],
    ['boolean', true],
    ['NaN', NaN],
    ['Infinity', Infinity],
  ])('should reject %s with invalid_request', (_label, value) => {
    expect(() => parseParentId(value)).toThrow(
      expect.objectContaining({ type: 'invalid_request', status: 400 }),
    );
  });
});

describe('parseRelationListRequest', () => {
  it('should return the validated list body with the parsed parentId', () => {
    expect(parseRelationListRequest({ parentId: 'a|b', projection: ['id'] })).toEqual({
      parentId: 'a|b',
      projection: ['id'],
    });
  });

  it('should reject a missing parentId with 400 invalid_request', () => {
    expect(() => parseRelationListRequest({ projection: ['id'] })).toThrow(
      expect.objectContaining({ type: 'invalid_request', status: 400 }),
    );
  });

  it('should reject an invalid list body with 400 invalid_request', () => {
    expect(() => parseRelationListRequest({ parentId: '7', projection: 'id' })).toThrow(
      expect.objectContaining({ type: 'invalid_request', status: 400 }),
    );
  });
});

describe('parseRelationCountRequest', () => {
  it('should return the validated count body with the parsed parentId', () => {
    expect(
      parseRelationCountRequest({ parentId: '7', filter: { field: 'a', operator: 'present' } }),
    ).toEqual({ parentId: '7', filter: { field: 'a', operator: 'present' } });
  });

  it('should reject a missing parentId with 400 invalid_request', () => {
    expect(() => parseRelationCountRequest({})).toThrow(
      expect.objectContaining({ type: 'invalid_request', status: 400 }),
    );
  });
});

describe('collectCountFieldPaths', () => {
  it('should collect field paths from the filter only', () => {
    const paths = collectCountFieldPaths({
      filter: { field: 'company:name', operator: 'present' },
    });

    expect(paths).toEqual(['company:name']);
  });
});
