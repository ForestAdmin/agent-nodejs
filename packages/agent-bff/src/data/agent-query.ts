import { invalidRequest } from '../http/bff-local-errors';

export interface BffSortClause {
  field: string;
  direction?: 'asc' | 'desc';
}

export interface BffPage {
  limit: number;
  offset: number;
}

export interface ListRequestBody {
  filter?: unknown;
  projection?: string[];
  sort?: BffSortClause[];
  page?: BffPage;
}

export interface CountRequestBody {
  filter?: unknown;
}

export type AgentQuery = Record<string, unknown> & { timezone: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Validate the untyped request body before it reaches the query builders, so malformed shapes
// (e.g. `projection` or `sort` as a string) surface as 400 invalid_request rather than a 500 from
// an array method blowing up downstream.
export function parseListRequest(body: unknown): ListRequestBody {
  if (!isPlainObject(body)) throw invalidRequest('Request body must be an object');

  const { filter, projection, sort, page } = body;

  if (projection !== undefined) {
    if (!Array.isArray(projection) || projection.some(field => typeof field !== 'string')) {
      throw invalidRequest('projection must be an array of field names');
    }
  }

  if (sort !== undefined) {
    const valid =
      Array.isArray(sort) &&
      sort.every(
        clause =>
          isPlainObject(clause) &&
          typeof clause.field === 'string' &&
          (clause.direction === undefined ||
            clause.direction === 'asc' ||
            clause.direction === 'desc'),
      );
    if (!valid) throw invalidRequest('sort must be an array of { field, direction? }');
  }

  if (filter !== undefined && !isPlainObject(filter)) {
    throw invalidRequest('filter must be an object');
  }

  if (page !== undefined) {
    if (!isPlainObject(page)) {
      throw invalidRequest('page must be an object with limit and offset');
    }

    if (!Number.isInteger(page.limit) || (page.limit as number) <= 0) {
      throw invalidRequest('page.limit must be a positive integer');
    }

    if (!Number.isInteger(page.offset) || (page.offset as number) < 0) {
      throw invalidRequest('page.offset must be a non-negative integer');
    }
  }

  return body as ListRequestBody;
}

export function parseCountRequest(body: unknown): CountRequestBody {
  if (!isPlainObject(body)) throw invalidRequest('Request body must be an object');

  if (body.filter !== undefined && !isPlainObject(body.filter)) {
    throw invalidRequest('filter must be an object');
  }

  return body as CountRequestBody;
}

interface ConditionTreeBranch {
  conditions: unknown[];
}

interface ConditionTreeLeaf {
  field: string;
}

function isBranch(node: unknown): node is ConditionTreeBranch {
  return (
    typeof node === 'object' &&
    node !== null &&
    Array.isArray((node as { conditions?: unknown }).conditions)
  );
}

function isLeaf(node: unknown): node is ConditionTreeLeaf {
  return (
    typeof node === 'object' &&
    node !== null &&
    typeof (node as { field?: unknown }).field === 'string'
  );
}

function collectFilterFields(filter: unknown, acc: string[]): void {
  if (isBranch(filter)) {
    filter.conditions.forEach(condition => collectFilterFields(condition, acc));
  } else if (isLeaf(filter)) {
    acc.push(filter.field);
  }
}

function serializeSort(sort: BffSortClause[]): string {
  return sort.map(({ field, direction }) => (direction === 'desc' ? `-${field}` : field)).join(',');
}

// `parseListRequest` guarantees `limit` > 0 and `offset` >= 0 are integers; this only enforces the
// page-model rule. The agent paginates by page number/size, so an arbitrary offset that is not a
// whole multiple of the limit cannot be expressed — reject it rather than return a shifted window.
function serializePage(page: BffPage): Record<string, number> {
  const { limit, offset } = page;

  if (offset % limit !== 0) {
    throw invalidRequest(`page.offset (${offset}) must be a multiple of page.limit (${limit})`);
  }

  return { 'page[size]': limit, 'page[number]': offset / limit + 1 };
}

export function buildListAgentQuery(
  collection: string,
  timezone: string,
  body: ListRequestBody,
): AgentQuery {
  const query: AgentQuery = { timezone };

  if (body.filter !== undefined) query.filters = JSON.stringify(body.filter);
  if (body.projection?.length) query[`fields[${collection}]`] = body.projection.join(',');
  if (body.sort?.length) query.sort = serializeSort(body.sort);
  if (body.page) Object.assign(query, serializePage(body.page));

  return query;
}

export function buildCountAgentQuery(timezone: string, body: CountRequestBody): AgentQuery {
  const query: AgentQuery = { timezone };

  if (body.filter !== undefined) query.filters = JSON.stringify(body.filter);

  return query;
}

export function collectListFieldPaths(body: ListRequestBody): string[] {
  const paths: string[] = [...(body.projection ?? [])];
  collectFilterFields(body.filter, paths);
  (body.sort ?? []).forEach(({ field }) => paths.push(field));

  return paths;
}

export function collectCountFieldPaths(body: CountRequestBody): string[] {
  const paths: string[] = [];
  collectFilterFields(body.filter, paths);

  return paths;
}
