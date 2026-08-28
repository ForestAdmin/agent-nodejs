import { z } from '../zod';

/**
 * The validation rules of a request body, declared once. `src/openapi/schemas.ts` decorates these
 * with names and descriptions to publish them, and derives the published components from them, so
 * the document and the runtime cannot drift apart.
 *
 * Every object here is closed: an undeclared key is a 400, never a silently stripped one. A
 * misspelled `filter` used to run the query unfiltered and answer 200, and a misspelled `direction`
 * used to sort ascending — a typo must not quietly change the returned rows.
 */
export const SortClauseInput = z.strictObject({
  field: z.string(),
  direction: z.enum(['asc', 'desc']).optional(),
});

export const PageInput = z.strictObject({
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});

export const ProjectionInput = z.array(z.string());

export const SearchInput = z.string();

export const SearchExtendedInput = z.boolean();

export const TimezoneInput = z.string();

export const ParentIdInput = z.union([z.string().regex(/\S/), z.number()]);

/**
 * Permitted here, checked by its own owner: `filter` by `assertFilter` and the capabilities
 * validator, `timezone` by the timezone middleware, `parentId` by `parseParentId`. A second rule
 * here would only disagree with the first at the margins — the middleware falls back to the header
 * for a non-string `timezone`, so re-typing it would turn a tolerated `null` into a 400.
 *
 * The filter TREE is not closed either: a leaf carrying `valu` instead of `value` still reaches the
 * agent. Closing it is a separate change — a condition node's wire format is the agent's, not this
 * one's, and rejecting a node it would have accepted breaks a filter that works today.
 */
const validatedElsewhere = z.unknown().optional();

export const ListFlatInputs = z.strictObject({
  filter: validatedElsewhere,
  projection: ProjectionInput.optional(),
  sort: z.array(SortClauseInput).optional(),
  page: PageInput.optional(),
  search: SearchInput.optional(),
  searchExtended: SearchExtendedInput.optional(),
  timezone: validatedElsewhere,
});

/** A count body carries no projection, sort or page. */
export const CountFlatInputs = z.strictObject({
  filter: validatedElsewhere,
  search: SearchInput.optional(),
  searchExtended: SearchExtendedInput.optional(),
  timezone: validatedElsewhere,
});

export const RelationListFlatInputs = ListFlatInputs.extend({ parentId: validatedElsewhere });

export const RelationCountFlatInputs = CountFlatInputs.extend({ parentId: validatedElsewhere });
