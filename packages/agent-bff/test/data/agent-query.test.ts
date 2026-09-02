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

type Parser = [string, (body: unknown) => unknown];

const logger = jest.fn();

const FLAT_PARSERS: Parser[] = [
  ['parseListRequest', body => parseListRequest(body, logger)],
  ['parseCountRequest', body => parseCountRequest(body, logger)],
];

const RELATION_PARSERS: Parser[] = [
  ['parseRelationListRequest', body => parseRelationListRequest(body, logger)],
  ['parseRelationCountRequest', body => parseRelationCountRequest(body, logger)],
];

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

describe('search in the outgoing agent query', () => {
  it('should send the search term under the wire name the agent reads', () => {
    expect(buildListAgentQuery('users', 'Europe/Paris', { search: 'ada' })).toEqual({
      timezone: 'Europe/Paris',
      search: 'ada',
    });
  });

  it('should send searchExtended under the wire name the agent reads', () => {
    expect(
      buildListAgentQuery('users', 'Europe/Paris', { search: 'ada', searchExtended: true }),
    ).toEqual({ timezone: 'Europe/Paris', search: 'ada', searchExtended: true });
  });

  it('should send searchExtended false when explicitly disabled alongside a search', () => {
    expect(
      buildListAgentQuery('users', 'Europe/Paris', { search: 'ada', searchExtended: false }),
    ).toEqual({ timezone: 'Europe/Paris', search: 'ada', searchExtended: false });
  });

  it('should send both the filter and the search so the agent intersects them', () => {
    expect(
      buildListAgentQuery('users', 'Europe/Paris', {
        filter: { field: 'active', operator: 'equal', value: true },
        search: 'ada',
      }),
    ).toEqual({
      timezone: 'Europe/Paris',
      filters: JSON.stringify({ field: 'active', operator: 'equal', value: true }),
      search: 'ada',
    });
  });

  it('should treat an empty search as absent', () => {
    expect(buildListAgentQuery('users', 'Europe/Paris', { search: '' })).toEqual({
      timezone: 'Europe/Paris',
    });
  });

  it('should treat a whitespace-only search as absent', () => {
    expect(buildListAgentQuery('users', 'Europe/Paris', { search: '   ' })).toEqual({
      timezone: 'Europe/Paris',
    });
  });

  it('should not send searchExtended when it arrives without a search', () => {
    expect(buildListAgentQuery('users', 'Europe/Paris', { searchExtended: true })).toEqual({
      timezone: 'Europe/Paris',
    });
  });

  it('should not send searchExtended when the search it accompanies is blank', () => {
    expect(
      buildListAgentQuery('users', 'Europe/Paris', { search: ' ', searchExtended: true }),
    ).toEqual({ timezone: 'Europe/Paris' });
  });

  it('should keep the inner spacing of the search term', () => {
    expect(buildListAgentQuery('users', 'Europe/Paris', { search: 'ada lovelace' }).search).toBe(
      'ada lovelace',
    );
  });

  it('should trim the search term on the way out', () => {
    expect(buildListAgentQuery('users', 'Europe/Paris', { search: '  ada  ' }).search).toBe('ada');
  });

  it('should accept the same search inputs on count as on list', () => {
    expect(buildCountAgentQuery('Europe/Paris', { search: 'ada', searchExtended: true })).toEqual({
      timezone: 'Europe/Paris',
      search: 'ada',
      searchExtended: true,
    });
  });

  it('should leave the count query untouched when the search is blank', () => {
    expect(buildCountAgentQuery('UTC', { search: '  ', searchExtended: true })).toEqual({
      timezone: 'UTC',
    });
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

    expect(parseListRequest(body, logger)).toBe(body);
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
    expect(() => parseListRequest(body, logger)).toThrow(
      expect.objectContaining({ type: 'invalid_request', status: 400 }),
    );
  });

  it('should pass search and searchExtended through rather than strip them', () => {
    expect(parseListRequest({ search: 'ada', searchExtended: true }, logger)).toMatchObject({
      search: 'ada',
      searchExtended: true,
    });
  });

  it.each([
    ['sort.0.direction', { sort: [{ field: 'a', direction: 'up' }] }],
    ['page.limit', { page: { limit: 0, offset: 0 } }],
    ['projection.0', { projection: [1] }],
    ['searchExtended', { searchExtended: 'true' }],
  ])('should name %s in the rejection message', (path, body) => {
    expect(() => parseListRequest(body, logger)).toThrow(
      expect.objectContaining({ message: expect.stringContaining(`${path}: `) }),
    );
  });

  it('should accept a blank search rather than rejecting a cleared search box', () => {
    expect(parseListRequest({ search: '   ' }, logger)).toMatchObject({ search: '   ' });
  });

  it.each([
    ['a non-string search', { search: 42 }],
    ['a null search', { search: null }],
    ['an array search', { search: ['ada'] }],
  ])('should reject %s with 400 invalid_request', (_label, body) => {
    expect(() => parseListRequest(body, logger)).toThrow(
      expect.objectContaining({ type: 'invalid_request', status: 400 }),
    );
  });

  it.each([
    ['the string "true"', { search: 'ada', searchExtended: 'true' }],
    ['the string "false"', { search: 'ada', searchExtended: 'false' }],
    ['the number 1', { search: 'ada', searchExtended: 1 }],
    ['the string "0"', { search: 'ada', searchExtended: '0' }],
    ['a null value', { search: 'ada', searchExtended: null }],
  ])(
    'should reject searchExtended sent as %s rather than coercing it like the agent does',
    (_label, body) => {
      expect(() => parseListRequest(body, logger)).toThrow(
        expect.objectContaining({ type: 'invalid_request', status: 400 }),
      );
    },
  );
});

describe('parseCountRequest', () => {
  it('should reject a string filter with 400 invalid_request', () => {
    expect(() => parseCountRequest({ filter: 'id' }, logger)).toThrow(
      expect.objectContaining({ type: 'invalid_request', status: 400 }),
    );
  });

  it.each([
    ['null', null],
    ['a string', 'foo'],
    ['an array', []],
  ])('should reject a non-object body (%s) with 400 invalid_request', (_label, body) => {
    expect(() => parseCountRequest(body, logger)).toThrow(
      expect.objectContaining({ type: 'invalid_request', status: 400 }),
    );
  });

  it('should pass search and searchExtended through rather than strip them', () => {
    expect(parseCountRequest({ search: 'ada', searchExtended: false }, logger)).toMatchObject({
      search: 'ada',
      searchExtended: false,
    });
  });

  it.each([
    ['a non-string search', { search: 42 }],
    ['a non-boolean searchExtended', { search: 'ada', searchExtended: 'true' }],
  ])('should reject %s with 400 invalid_request', (_label, body) => {
    expect(() => parseCountRequest(body, logger)).toThrow(
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

  it.each(FLAT_PARSERS)('should reject it in %s with 400 invalid_request', (_label, parse) => {
    expect(() => parse({ filter: READABLE_AS_BOTH })).toThrow(
      expect.objectContaining({ type: 'invalid_request', status: 400 }),
    );
  });

  it('should reject it nested inside a legitimate branch', () => {
    expect(() =>
      parseListRequest({ filter: { aggregator: 'And', conditions: [READABLE_AS_BOTH] } }, logger),
    ).toThrow(expect.objectContaining({ type: 'invalid_request', status: 400 }));
  });

  it('should be invisible to the field-path collector', () => {
    expect(collectCountFieldPaths({ filter: READABLE_AS_BOTH })).toEqual([]);
  });

  it('should still accept a plain leaf and a plain branch', () => {
    const leaf = { field: 'title', operator: 'Present' };

    expect(() => parseCountRequest({ filter: leaf }, logger)).not.toThrow();
    expect(() =>
      parseListRequest({ filter: { aggregator: 'And', conditions: [leaf] } }, logger),
    ).not.toThrow();
  });

  it('should reject a filter nested past the depth cap with 400 rather than blowing the stack', () => {
    let filter: unknown = { field: 'title', operator: 'Present' };

    for (let i = 0; i <= MAX_PARSED_FILTER_DEPTH; i += 1) {
      filter = { aggregator: 'And', conditions: [filter] };
    }

    expect(() => parseCountRequest({ filter }, logger)).toThrow(
      expect.objectContaining({
        type: 'filter_too_deep',
        status: 400,
        details: { maxDepth: MAX_PARSED_FILTER_DEPTH },
      }),
    );
  });
});

describe('a filter node carrying an unknown key', () => {
  it.each(FLAT_PARSERS)('should reject a misspelled leaf value in %s', (_label, parse) => {
    expect(() => parse({ filter: { field: 'title', operator: 'Equal', valu: 'x' } })).toThrow(
      expect.objectContaining({
        type: 'invalid_request',
        status: 400,
        message: 'A filter node cannot carry "valu"',
      }),
    );
  });

  it('should reject a misspelled leaf value nested inside a branch', () => {
    expect(() =>
      parseListRequest(
        {
          filter: {
            aggregator: 'And',
            conditions: [{ field: 'title', operator: 'Equal', valu: 'x' }],
          },
        },
        logger,
      ),
    ).toThrow(expect.objectContaining({ type: 'invalid_request', status: 400 }));
  });

  it('should reject a misspelled aggregator on a branch', () => {
    expect(() =>
      parseCountRequest({ filter: { agregator: 'And', conditions: [] } }, logger),
    ).toThrow(
      expect.objectContaining({
        type: 'invalid_request',
        status: 400,
        message: 'A filter node cannot carry "agregator"',
      }),
    );
  });

  it('should reject a node readable as neither a leaf nor a branch', () => {
    expect(() =>
      parseCountRequest({ filter: { feild: 'title', operator: 'Equal', value: 'x' } }, logger),
    ).toThrow(expect.objectContaining({ type: 'invalid_request', status: 400 }));
  });

  it('should accept an empty filter object, which is how an absent filter is spelled', () => {
    expect(() => parseCountRequest({ filter: {} }, logger)).not.toThrow();
  });

  it('should accept a leaf carrying field, operator and value', () => {
    expect(() =>
      parseCountRequest({ filter: { field: 'title', operator: 'Equal', value: 'x' } }, logger),
    ).not.toThrow();
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
    expect(parseRelationListRequest({ parentId: 'a|b', projection: ['id'] }, logger)).toEqual({
      parentId: 'a|b',
      projection: ['id'],
    });
  });

  it('should reject a missing parentId with 400 invalid_request', () => {
    expect(() => parseRelationListRequest({ projection: ['id'] }, logger)).toThrow(
      expect.objectContaining({ type: 'invalid_request', status: 400 }),
    );
  });

  it('should reject an invalid list body with 400 invalid_request', () => {
    expect(() => parseRelationListRequest({ parentId: '7', projection: 'id' }, logger)).toThrow(
      expect.objectContaining({ type: 'invalid_request', status: 400 }),
    );
  });
});

describe('parseRelationCountRequest', () => {
  it('should return the validated count body with the parsed parentId', () => {
    expect(
      parseRelationCountRequest(
        { parentId: '7', filter: { field: 'a', operator: 'present' } },
        logger,
      ),
    ).toEqual({ parentId: '7', filter: { field: 'a', operator: 'present' } });
  });

  it('should reject a missing parentId with 400 invalid_request', () => {
    expect(() => parseRelationCountRequest({}, logger)).toThrow(
      expect.objectContaining({ type: 'invalid_request', status: 400 }),
    );
  });
});

describe('unknown keys', () => {
  const REJECTED = expect.objectContaining({ type: 'invalid_request', status: 400 });

  it.each(FLAT_PARSERS)(
    'should reject a misspelled filter on %s rather than run unfiltered',
    (_label, parse) => {
      expect(() => parse({ filters: { field: 'plan', operator: 'Equal', value: 'free' } })).toThrow(
        REJECTED,
      );
    },
  );

  it.each(FLAT_PARSERS)('should name the unknown key in the %s rejection', (_label, parse) => {
    expect(() => parse({ totallyUnknownField: 123 })).toThrow(
      expect.objectContaining({ message: expect.stringContaining('totallyUnknownField') }),
    );
  });

  it('should reject a misspelled projection rather than return every field', () => {
    expect(() => parseListRequest({ projections: ['id'] }, logger)).toThrow(REJECTED);
  });

  it('should reject a list-only key on a count body, where paging and projection mean nothing', () => {
    expect(() => parseCountRequest({ projection: ['id'] }, logger)).toThrow(REJECTED);
    expect(() => parseCountRequest({ sort: [{ field: 'id' }] }, logger)).toThrow(REJECTED);
    expect(() => parseCountRequest({ page: { limit: 10, offset: 0 } }, logger)).toThrow(REJECTED);
  });

  it('should reject parentId on a plain list, where a parent id means nothing', () => {
    expect(() => parseListRequest({ parentId: '7' }, logger)).toThrow(REJECTED);
  });

  it.each(RELATION_PARSERS)('should reject a misspelled filter on %s', (_label, parse) => {
    expect(() => parse({ parentId: '7', filters: { field: 'a', operator: 'present' } })).toThrow(
      REJECTED,
    );
  });

  it.each(RELATION_PARSERS)('should still accept parentId on %s', (_label, parse) => {
    expect(parse({ parentId: '7' })).toMatchObject({ parentId: '7' });
  });

  it.each(FLAT_PARSERS)(
    'should still accept the timezone the middleware reads on %s',
    (_label, parse) => {
      expect(parse({ timezone: 'Europe/Paris' })).toMatchObject({ timezone: 'Europe/Paris' });
    },
  );

  it.each(FLAT_PARSERS)(
    'should reject a non-string timezone on %s rather than resolve one the caller did not send',
    (_label, parse) => {
      expect(() => parse({ timezone: null })).toThrow(REJECTED);
      expect(() => parse({ timezone: 42 })).toThrow(REJECTED);
    },
  );

  it.each(FLAT_PARSERS)('should log the rejected key on %s, never the value', (_label, parse) => {
    logger.mockClear();
    expect(() => parse({ filters: { value: 'secret' } })).toThrow(REJECTED);
    expect(logger).toHaveBeenCalledWith('Warn', 'Request body rejected', {
      reason: 'Unrecognized key: "filters"',
    });
    expect(JSON.stringify(logger.mock.calls)).not.toContain('secret');
  });

  it('should name the unrecognized key even when another issue comes first', () => {
    logger.mockClear();
    expect(() => parseListRequest({ filters: {}, page: { limit: 0, offset: 0 } }, logger)).toThrow(
      expect.objectContaining({ message: expect.stringContaining('filters') }),
    );
  });

  it('should reject a misspelled sort direction rather than sort ascending', () => {
    expect(() =>
      parseListRequest({ sort: [{ field: 'createdAt', direciton: 'desc' }] }, logger),
    ).toThrow(REJECTED);
  });

  it('should reject an unknown key inside page', () => {
    expect(() => parseListRequest({ page: { limit: 10, offset: 0, cursor: 'x' } }, logger)).toThrow(
      REJECTED,
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
