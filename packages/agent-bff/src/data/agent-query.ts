import type { PageInput, SortClauseInput } from './request-schemas';
import type { ZodType, z } from 'zod';

import {
  CountFlatInputs,
  ListFlatInputs,
  RelationCountFlatInputs,
  RelationListFlatInputs,
} from './request-schemas';
import { invalidRequest } from '../http/bff-local-errors';
import { MAX_FILTER_DEPTH, isBranch, isLeaf } from '../validation/capabilities-validator';
import { filterTooDeep } from '../validation/validation-errors';

export { MAX_FILTER_DEPTH as MAX_PARSED_FILTER_DEPTH };

// Inferred, never transcribed: a hand-written interface drifts from the schema that actually
// accepts the body, and the parsers below return that body by reference.
export type BffSortClause = z.infer<typeof SortClauseInput>;

export type BffPage = z.infer<typeof PageInput>;

export type ListRequestBody = z.infer<typeof ListFlatInputs>;

export type CountRequestBody = z.infer<typeof CountFlatInputs>;

export type RelationListRequestBody = z.infer<typeof RelationListFlatInputs> & { parentId: string };

export type RelationCountRequestBody = z.infer<typeof RelationCountFlatInputs> & {
  parentId: string;
};

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
 * Checks the flat inputs against the shared schema and reports the first failure as
 * 400 invalid_request, so a malformed shape (`projection` as a string, a fractional `page.limit`)
 * surfaces as a client error rather than a 500 from an array method blowing up downstream.
 *
 * The schemas are closed, so an undeclared key is reported the same way rather than stripped: a
 * misspelled `filter` must not run the query unfiltered and answer 200. The declared keys —
 * `filter`, `timezone`, and `parentId` on a relation — travel through untouched, and the body is
 * returned by reference, not rebuilt.
 */
function assertFlatInputs(schema: ZodType, body: Record<string, unknown>): void {
  const result = schema.safeParse(body);
  if (result.success) return;

  const [issue] = result.error.issues;
  const path = issue.path.join('.');

  throw invalidRequest(path ? `${path}: ${issue.message}` : issue.message);
}

function assertFilter(filter: unknown): void {
  if (filter === undefined) return;
  if (!isPlainObject(filter)) throw invalidRequest('filter must be an object');

  assertNoNodeReadableAsBothLeafAndBranch(filter);
}

function parseRequest<S extends ZodType>(schema: S, body: unknown): z.output<S> {
  if (!isPlainObject(body)) throw invalidRequest('Request body must be an object');

  assertFlatInputs(schema, body);
  assertFilter(body.filter);

  return body as z.output<S>;
}

export function parseListRequest(body: unknown): ListRequestBody {
  return parseRequest(ListFlatInputs, body);
}

export function parseCountRequest(body: unknown): CountRequestBody {
  return parseRequest(CountFlatInputs, body);
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

  return { ...parseRequest(RelationListFlatInputs, body), parentId };
}

export function parseRelationCountRequest(body: unknown): RelationCountRequestBody {
  const parentId = parseParentId((body as { parentId?: unknown } | null)?.parentId);

  return { ...parseRequest(RelationCountFlatInputs, body), parentId };
}

export function collectCountFieldPaths(body: CountRequestBody): string[] {
  const paths: string[] = [];
  collectFilterFields(body.filter, paths);

  return paths;
}
