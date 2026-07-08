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

function serializePage(page: BffPage): Record<string, number> {
  const { limit, offset } = page;

  if (!Number.isInteger(limit) || limit <= 0) {
    throw invalidRequest(`Invalid page.limit: ${limit}`);
  }

  if (!Number.isInteger(offset) || offset < 0) {
    throw invalidRequest(`Invalid page.offset: ${offset}`);
  }

  // The agent paginates by page number/size, so an arbitrary offset that is not a whole multiple
  // of the limit cannot be expressed. Reject it rather than silently return a shifted window.
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
