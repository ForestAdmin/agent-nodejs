import { z } from '../zod';

/**
 * The validation rules of a request body, declared once. `src/openapi/schemas.ts` decorates these
 * with names and descriptions to publish them, and the parsers below check bodies against them, so
 * the document and the runtime cannot drift apart.
 *
 * `filter` is deliberately absent: its operators are checked against the collection capabilities
 * (`capabilities-validator`), and a node readable as both leaf and branch has no schema equivalent,
 * so it keeps its own path in `agent-query.ts`.
 */
export const SortClauseInput = z.object({
  field: z.string(),
  direction: z.enum(['asc', 'desc']).optional(),
});

export const PageInput = z.object({
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});

export const ProjectionInput = z.array(z.string());

export const SearchInput = z.string();

export const SearchExtendedInput = z.boolean();

export const TimezoneInput = z.string();

export const ParentIdInput = z.union([z.string().regex(/\S/), z.number()]);

/** Everything a list body carries except `filter`, which is validated separately. */
export const ListFlatInputs = z.object({
  projection: ProjectionInput.optional(),
  sort: z.array(SortClauseInput).optional(),
  page: PageInput.optional(),
  search: SearchInput.optional(),
  searchExtended: SearchExtendedInput.optional(),
});

/** A count body carries no projection, sort or page. */
export const CountFlatInputs = z.object({
  search: SearchInput.optional(),
  searchExtended: SearchExtendedInput.optional(),
});
