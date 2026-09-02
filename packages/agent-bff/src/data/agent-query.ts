import type { BffHttpError } from '../http/bff-http-error';
import type { PageInput, SortClauseInput } from './request-schemas';
import type { Logger } from '../ports/logger-port';
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

const LEAF_KEYS = ['field', 'operator', 'value'];
const BRANCH_KEYS = ['aggregator', 'conditions'];

function rejectBody(logger: Logger, error: BffHttpError): never {
  logger('Warn', 'Request body rejected', { reason: error.message });

  throw error;
}

// The tree is closed like the flat body is: a leaf carrying `valu` instead of `value` builds a
// condition with `value: undefined`, which the agent reads as null and runs — a typo must not
// silently change the returned rows.
function assertNoStrayKey(node: Record<string, unknown>, allowed: string[], logger: Logger): void {
  const stray = Object.keys(node).find(key => !allowed.includes(key));

  if (stray !== undefined) {
    rejectBody(logger, invalidRequest(`A filter node cannot carry "${stray}"`));
  }
}

function assertFilterNode(node: unknown, logger: Logger, depth = 0): void {
  if (depth > MAX_FILTER_DEPTH) rejectBody(logger, filterTooDeep(MAX_FILTER_DEPTH));
  if (!isPlainObject(node)) return;

  const readableAsBranch = isBranch(node);

  if (isLeaf(node) && readableAsBranch) {
    rejectBody(logger, invalidRequest('A filter node cannot carry both "field" and "conditions"'));
  }

  if (readableAsBranch) {
    assertNoStrayKey(node, BRANCH_KEYS, logger);
    node.conditions.forEach(condition => assertFilterNode(condition, logger, depth + 1));

    return;
  }

  if (isLeaf(node)) {
    assertNoStrayKey(node, LEAF_KEYS, logger);

    return;
  }

  // Neither readable as a leaf nor as a branch: `feild` instead of `field` reaches the agent as a
  // node it cannot act on. An empty object stays allowed — it is how an absent filter is spelled.
  assertNoStrayKey(node, [], logger);
}

function assertFlatInputs(schema: ZodType, body: Record<string, unknown>, logger: Logger): void {
  const result = schema.safeParse(body);
  if (result.success) return;

  const { issues } = result.error;
  const issue = issues.find(candidate => candidate.code === 'unrecognized_keys') ?? issues[0];
  const path = issue.path.join('.');
  const reason = path ? `${path}: ${issue.message}` : issue.message;

  rejectBody(logger, invalidRequest(reason));
}

function assertFilter(filter: unknown, logger: Logger): void {
  if (filter === undefined) return;
  if (!isPlainObject(filter)) rejectBody(logger, invalidRequest('filter must be an object'));

  assertFilterNode(filter, logger);
}

function parseRequest<S extends ZodType>(schema: S, body: unknown, logger: Logger): z.output<S> {
  if (!isPlainObject(body)) {
    rejectBody(logger, invalidRequest('Request body must be an object'));
  }

  assertFlatInputs(schema, body, logger);
  assertFilter(body.filter, logger);

  return body as z.output<S>;
}

export function parseListRequest(body: unknown, logger: Logger): ListRequestBody {
  return parseRequest(ListFlatInputs, body, logger);
}

export function parseCountRequest(body: unknown, logger: Logger): CountRequestBody {
  return parseRequest(CountFlatInputs, body, logger);
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
export function parseParentId(parentId: unknown, logger: Logger): string {
  if (typeof parentId === 'string') {
    if (parentId.trim() === '') {
      rejectBody(logger, invalidRequest('parentId must not be empty'));
    }

    return parentId;
  }

  if (typeof parentId === 'number' && Number.isFinite(parentId)) {
    return String(parentId);
  }

  rejectBody(
    logger,
    invalidRequest('parentId is required and must be a non-empty string or a number'),
  );
}

export function parseRelationListRequest(body: unknown, logger: Logger): RelationListRequestBody {
  const parentId = parseParentId((body as { parentId?: unknown } | null)?.parentId, logger);

  return { ...parseRequest(RelationListFlatInputs, body, logger), parentId };
}

export function parseRelationCountRequest(body: unknown, logger: Logger): RelationCountRequestBody {
  const parentId = parseParentId((body as { parentId?: unknown } | null)?.parentId, logger);

  return { ...parseRequest(RelationCountFlatInputs, body, logger), parentId };
}

export function collectCountFieldPaths(body: CountRequestBody): string[] {
  const paths: string[] = [];
  collectFilterFields(body.filter, paths);

  return paths;
}
