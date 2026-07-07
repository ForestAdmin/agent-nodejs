import {
  buildCountAgentQuery,
  buildListAgentQuery,
  collectCountFieldPaths,
  collectListFieldPaths,
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

  it('should reject a non-positive limit', () => {
    expect(() =>
      buildListAgentQuery('users', 'Europe/Paris', { page: { limit: 0, offset: 0 } }),
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

describe('collectCountFieldPaths', () => {
  it('should collect field paths from the filter only', () => {
    const paths = collectCountFieldPaths({
      filter: { field: 'company:name', operator: 'present' },
    });

    expect(paths).toEqual(['company:name']);
  });
});
