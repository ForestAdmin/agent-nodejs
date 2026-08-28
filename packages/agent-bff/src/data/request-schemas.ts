import { z } from '../zod';

/**
 * The validation rules of a request body, declared once. `src/openapi/schemas.ts` decorates these
 * with names and descriptions to publish them, and the parsers below check bodies against them, so
 * the document and the runtime cannot drift apart.
 *
 * Every object here is closed: an undeclared key is a 400, never a silently stripped one. A
 * misspelled `filter` used to run the query unfiltered and answer 200, and a misspelled `direction`
 * used to sort ascending — a typo must not quietly change the returned rows.
 *
 * `filter` is declared but not described: its operators are checked against the collection
 * capabilities (`capabilities-validator`), and a node readable as both leaf and branch has no
 * schema equivalent, so its own path in `agent-query.ts` stays its only validation. The tree is
 * therefore NOT closed — a leaf carrying `valu` instead of `value` still reaches the agent. Closing
 * it is a separate change: the wire format of a condition node is the agent's, not this one's, and
 * rejecting a node it would have accepted breaks a filter that works today.
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
 * `timezone` is only PERMITTED here. The timezone middleware reads it off the body before the route
 * runs and falls back to the header or the deployment default when it is not a string
 * (`timezone/timezone-middleware.ts`), so type-checking it a second time would turn a tolerated
 * `null` into a 400 — a value this change has no reason to reject.
 */
export const ListFlatInputs = z.strictObject({
  filter: z.unknown().optional(),
  projection: ProjectionInput.optional(),
  sort: z.array(SortClauseInput).optional(),
  page: PageInput.optional(),
  search: SearchInput.optional(),
  searchExtended: SearchExtendedInput.optional(),
  timezone: z.unknown().optional(),
});

/** A count body carries no projection, sort or page. */
export const CountFlatInputs = z.strictObject({
  filter: z.unknown().optional(),
  search: SearchInput.optional(),
  searchExtended: SearchExtendedInput.optional(),
  timezone: z.unknown().optional(),
});

/**
 * Same for `parentId`: `parseParentId` stays its single validator, so its message is the one a
 * caller sees rather than a second, subtly different rule's.
 */
export const RelationListFlatInputs = ListFlatInputs.extend({ parentId: z.unknown().optional() });

export const RelationCountFlatInputs = CountFlatInputs.extend({ parentId: z.unknown().optional() });
