import { invalidRequest } from '../http/bff-local-errors';
import { MAX_FILTER_DEPTH, isBranch, isLeaf } from '../validation/capabilities-validator';
import { filterTooDeep } from '../validation/validation-errors';

export { MAX_FILTER_DEPTH as MAX_PARSED_FILTER_DEPTH };

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
  search?: string;
  searchExtended?: boolean;
}

export interface CountRequestBody {
  filter?: unknown;
  search?: string;
  searchExtended?: boolean;
}

export type RelationListRequestBody = ListRequestBody & { parentId: string };

export type RelationCountRequestBody = CountRequestBody & { parentId: string };

export type AgentQuery = Record<string, unknown> & { timezone: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertNoNodeReadableAsBothLeafAndBranch(node: unknown, depth = 0): void {
  if (depth > MAX_FILTER_DEPTH) throw filterTooDeep(MAX_FILTER_DEPTH);
  if (typeof node !== 'object' || node === null) return;

  const readableAsBranch = isBranch(node);

  if (isLeaf(node) && readableAsBranch) {
    throw invalidRequest('A filter node cannot carry both "field" and "conditions"');
  }

  if (readableAsBranch) {
    node.conditions.forEach(condition =>
      assertNoNodeReadableAsBothLeafAndBranch(condition, depth + 1),
    );
  }
}

/**
 * The agent reads `search`/`searchExtended` from query params, so it coerces both from strings.
 * The BFF is a JSON contract: a real boolean is required here, like `page.limit` requires a real
 * integer. Only the type is checked — whether a blank search is worth sending is the builder's
 * call, so a cleared search box parses the same way as an absent one.
 */
function assertValidSearch(search: unknown, searchExtended: unknown): void {
  if (search !== undefined && typeof search !== 'string') {
    throw invalidRequest('search must be a string');
  }

  if (searchExtended !== undefined && typeof searchExtended !== 'boolean') {
    throw invalidRequest('searchExtended must be a boolean');
  }
}

// Validate the untyped request body before it reaches the query builders, so malformed shapes
// (e.g. `projection` or `sort` as a string) surface as 400 invalid_request rather than a 500 from
// an array method blowing up downstream.
export function parseListRequest(body: unknown): ListRequestBody {
  if (!isPlainObject(body)) throw invalidRequest('Request body must be an object');

  const { filter, projection, sort, page } = body;

  assertValidSearch(body.search, body.searchExtended);

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

  if (filter !== undefined) {
    if (!isPlainObject(filter)) throw invalidRequest('filter must be an object');
    assertNoNodeReadableAsBothLeafAndBranch(filter);
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

  assertValidSearch(body.search, body.searchExtended);

  if (body.filter !== undefined) {
    if (!isPlainObject(body.filter)) throw invalidRequest('filter must be an object');
    assertNoNodeReadableAsBothLeafAndBranch(body.filter);
  }

  return body as CountRequestBody;
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

/**
 * `search` and `searchExtended` are the wire names the agent reads; no other spelling is parsed.
 *
 * A blank search is dropped rather than forwarded. The agent's search decorator already treats it
 * as absent, but `parseSearch` guards on a truthy value, so a whitespace-only search would raise
 * "Collection is not searchable" on a non-searchable collection while an empty one would not — a
 * cleared search box must not depend on how many spaces it holds.
 *
 * `searchExtended` only ships alongside a real search: on its own it changes nothing agent-side,
 * and emitting it would alter the outgoing query of every search-less request.
 *
 * The value is trimmed on the way out, not in the parser: parsing stays pure validation here, and
 * `parseListRequest` returns the caller's body untouched, which its own callers rely on.
 */
function applySearch(
  query: AgentQuery,
  body: Pick<CountRequestBody, 'search' | 'searchExtended'>,
): void {
  const search = body.search?.trim();
  if (!search) return;

  query.search = search;
  if (body.searchExtended !== undefined) query.searchExtended = body.searchExtended;
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
  applySearch(query, body);

  return query;
}

export function buildCountAgentQuery(timezone: string, body: CountRequestBody): AgentQuery {
  const query: AgentQuery = { timezone };

  if (body.filter !== undefined) query.filters = JSON.stringify(body.filter);
  applySearch(query, body);

  return query;
}

export function collectListFieldPaths(body: ListRequestBody): string[] {
  const paths: string[] = [...(body.projection ?? [])];
  collectFilterFields(body.filter, paths);
  (body.sort ?? []).forEach(({ field }) => paths.push(field));

  return paths;
}

// The parent record id is opaque: a packed/composite id must survive unchanged, so its content is
// never inspected — only presence and primitive type. A finite number (single numeric pk) is
// coerced to string; anything else is a BFF-local 400 with no agent call.
export function parseParentId(parentId: unknown): string {
  if (typeof parentId === 'string') {
    if (parentId.trim() === '') throw invalidRequest('parentId must not be empty');

    return parentId;
  }

  if (typeof parentId === 'number' && Number.isFinite(parentId)) {
    return String(parentId);
  }

  throw invalidRequest('parentId is required and must be a non-empty string or a number');
}

export function parseRelationListRequest(body: unknown): RelationListRequestBody {
  const parentId = parseParentId((body as { parentId?: unknown } | null)?.parentId);

  return { ...parseListRequest(body), parentId };
}

export function parseRelationCountRequest(body: unknown): RelationCountRequestBody {
  const parentId = parseParentId((body as { parentId?: unknown } | null)?.parentId);

  return { ...parseCountRequest(body), parentId };
}

export function collectCountFieldPaths(body: CountRequestBody): string[] {
  const paths: string[] = [];
  collectFilterFields(body.filter, paths);

  return paths;
}
