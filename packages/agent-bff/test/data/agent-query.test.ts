import {
  MAX_PARSED_FILTER_DEPTH,
  collectCountFieldPaths,
  collectListFieldPaths,
  parseCountRequest,
  parseListRequest,
  parseParentId,
  parseRelationCountRequest,
  parseRelationListRequest,
  toSelectOptions,
} from '../../src/data/agent-query';
import { MAX_PAGE_LIMIT } from '../../src/data/request-schemas';

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

describe('toSelectOptions', () => {
  it('should always carry the resolved time zone', () => {
    expect(toSelectOptions('Europe/Paris', {})).toEqual({ timezone: 'Europe/Paris' });
  });

  it('should name the filter, projection, sort, page and search the way agent-client reads them', () => {
    const filter = { field: 'email', operator: 'Present' };

    expect(
      toSelectOptions('Europe/Paris', {
        filter,
        projection: ['id', 'email'],
        sort: [
          { field: 'email', direction: 'desc' },
          { field: 'id', direction: 'asc' },
        ],
        page: { limit: 20, offset: 40 },
        search: 'ada',
        searchExtended: true,
      }),
    ).toEqual({
      timezone: 'Europe/Paris',
      filters: filter,
      fields: ['id', 'email'],
      sort: [
        { field: 'email', ascending: false },
        { field: 'id', ascending: true },
      ],
      pagination: { size: 20, number: 3 },
      search: 'ada',
      shouldSearchInRelation: true,
    });
  });

  it('should default an unspecified sort direction to ascending', () => {
    expect(toSelectOptions('Europe/Paris', { sort: [{ field: 'email' }] }).sort).toEqual([
      { field: 'email', ascending: true },
    ]);
  });

  it('should forward a page.limit at the maximum as the page size', () => {
    expect(
      toSelectOptions('Europe/Paris', { page: { limit: MAX_PAGE_LIMIT, offset: 0 } }).pagination,
    ).toEqual({ size: MAX_PAGE_LIMIT, number: 1 });
  });

  it('should keep an empty filter, which the agent receives as one', () => {
    expect(toSelectOptions('Europe/Paris', { filter: {} }).filters).toEqual({});
  });

  it('should leave out an empty projection and an empty sort', () => {
    expect(toSelectOptions('Europe/Paris', { projection: [], sort: [] })).toEqual({
      timezone: 'Europe/Paris',
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
    ['a page.limit above the maximum', { page: { limit: MAX_PAGE_LIMIT + 1, offset: 0 } }],
    ['the unbounded repro limit', { page: { limit: 1_000_000_000, offset: 0 } }],
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
    ['page.limit', { page: { limit: MAX_PAGE_LIMIT + 1, offset: 0 } }],
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

describe('a branch carrying an aggregator the document does not enumerate', () => {
  it.each([
    ['a number', 5],
    ['an unknown word', 'xor'],
    ['null', null],
  ])('should reject %s with 400 invalid_request', (_label, aggregator) => {
    expect(() => parseCountRequest({ filter: { aggregator, conditions: [] } }, logger)).toThrow(
      expect.objectContaining({
        type: 'invalid_request',
        status: 400,
        message: 'A filter branch aggregator must be one of: And, Or',
      }),
    );
  });

  it.each([['And'], ['Or'], ['and'], ['or']])(
    'should accept %s, which the agent parses once toWireFilter lowercases it',
    aggregator => {
      expect(() =>
        parseCountRequest({ filter: { aggregator, conditions: [] } }, logger),
      ).not.toThrow();
    },
  );

  it('should reject it nested inside a legitimate branch', () => {
    expect(() =>
      parseListRequest(
        { filter: { aggregator: 'And', conditions: [{ aggregator: 5, conditions: [] }] } },
        logger,
      ),
    ).toThrow(expect.objectContaining({ type: 'invalid_request', status: 400 }));
  });

  it('should still accept a branch without any aggregator, which the document allows', () => {
    expect(() => parseCountRequest({ filter: { conditions: [] } }, logger)).not.toThrow();
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
    expect(parseParentId('a|b', logger)).toBe('a|b');
    expect(parseParentId('550e8400-e29b-41d4-a716-446655440000', logger)).toBe(
      '550e8400-e29b-41d4-a716-446655440000',
    );
  });

  it('should coerce a finite number to a string', () => {
    expect(parseParentId(42, logger)).toBe('42');
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
    expect(() => parseParentId(value, logger)).toThrow(
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

  it.each(FLAT_PARSERS)(
    'should reject a blank timezone on %s rather than silently resolve another one',
    (_label, parse) => {
      const namesTimezone = expect.objectContaining({
        type: 'invalid_request',
        status: 400,
        message: expect.stringContaining('timezone'),
      });

      expect(() => parse({ timezone: '' })).toThrow(namesTimezone);
      expect(() => parse({ timezone: '   ' })).toThrow(namesTimezone);
    },
  );

  it('should reject an offset that is not a multiple of the limit, and log it', () => {
    logger.mockClear();
    expect(() => parseListRequest({ page: { limit: 20, offset: 15 } }, logger)).toThrow(
      expect.objectContaining({ type: 'invalid_request', status: 400 }),
    );
    expect(logger).toHaveBeenCalledWith('Warn', 'Request body rejected', {
      reason: 'page: offset (15) must be a multiple of limit (20)',
    });
  });

  it.each(FLAT_PARSERS)('should log the rejected key on %s, never the value', (_label, parse) => {
    logger.mockClear();
    expect(() => parse({ filters: { value: 'secret' } })).toThrow(REJECTED);
    expect(logger).toHaveBeenCalledWith('Warn', 'Request body rejected', {
      reason: 'Unrecognized key: "filters"',
    });
    expect(JSON.stringify(logger.mock.calls)).not.toContain('secret');
  });

  it.each(FLAT_PARSERS)(
    'should log a stray key inside the filter tree on %s, never the value',
    (_label, parse) => {
      logger.mockClear();
      expect(() =>
        parse({ filter: { field: 'title', operator: 'Equal', valu: 'secret' } }),
      ).toThrow(REJECTED);
      expect(logger).toHaveBeenCalledWith('Warn', 'Request body rejected', {
        reason: 'A filter node cannot carry "valu"',
      });
      expect(JSON.stringify(logger.mock.calls)).not.toContain('secret');
    },
  );

  it.each([
    ['a non-object body', 'nope', 'Request body must be an object'],
    ['a non-object filter', { filter: 'id' }, 'filter must be an object'],
  ])('should log %s too, not only zod rejections', (_label, body, reason) => {
    logger.mockClear();
    expect(() => parseListRequest(body, logger)).toThrow(REJECTED);
    expect(logger).toHaveBeenCalledWith('Warn', 'Request body rejected', { reason });
  });

  it.each(RELATION_PARSERS)(
    'should log a parentId failure on %s, which the schema never sees',
    (_label, parse) => {
      logger.mockClear();
      expect(() => parse({ projection: ['id'] })).toThrow(REJECTED);
      expect(logger).toHaveBeenCalledWith('Warn', 'Request body rejected', {
        reason: 'parentId is required and must be a non-empty string or a number',
      });
    },
  );

  it('should log a filter nested past the depth cap', () => {
    let filter: unknown = { field: 'title', operator: 'Present' };

    for (let i = 0; i <= MAX_PARSED_FILTER_DEPTH; i += 1) {
      filter = { aggregator: 'And', conditions: [filter] };
    }

    logger.mockClear();
    expect(() => parseCountRequest({ filter }, logger)).toThrow(
      expect.objectContaining({ type: 'filter_too_deep' }),
    );
    expect(logger).toHaveBeenCalledWith('Warn', 'Request body rejected', {
      reason: `Filter nesting exceeds the maximum depth of ${MAX_PARSED_FILTER_DEPTH}`,
    });
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
