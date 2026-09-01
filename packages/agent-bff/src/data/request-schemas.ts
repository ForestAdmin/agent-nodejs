import { z } from '../zod';

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

const validatedElsewhere = z.unknown().optional();

export const ListFlatInputs = z.strictObject({
  filter: validatedElsewhere,
  projection: ProjectionInput.optional(),
  sort: z.array(SortClauseInput).optional(),
  page: PageInput.optional(),
  search: SearchInput.optional(),
  searchExtended: SearchExtendedInput.optional(),
  timezone: TimezoneInput.optional(),
});

/** A count body carries no projection, sort or page. */
export const CountFlatInputs = z.strictObject({
  filter: validatedElsewhere,
  search: SearchInput.optional(),
  searchExtended: SearchExtendedInput.optional(),
  timezone: TimezoneInput.optional(),
});

export const RelationListFlatInputs = ListFlatInputs.extend({ parentId: validatedElsewhere });

export const RelationCountFlatInputs = CountFlatInputs.extend({ parentId: validatedElsewhere });
