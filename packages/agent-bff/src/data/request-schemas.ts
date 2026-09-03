import { z } from '../zod';

export const NON_BLANK_PATTERN = '\\S';

const NonBlankString = z.string().regex(new RegExp(NON_BLANK_PATTERN));

export const SortClauseInput = z.strictObject({
  field: z.string(),
  direction: z.enum(['asc', 'desc']).optional(),
});

export const MAX_PAGE_LIMIT = 1000;

export const PageInput = z
  .strictObject({
    limit: z.number().int().positive().max(MAX_PAGE_LIMIT),
    offset: z.number().int().nonnegative(),
  })
  .refine(({ limit, offset }) => offset % limit === 0, {
    error: ({ input }) => {
      const { limit, offset } = input as { limit: number; offset: number };

      return `offset (${offset}) must be a multiple of limit (${limit})`;
    },
  });

export const ProjectionInput = z.array(z.string());

export const SearchInput = z.string();

export const SearchExtendedInput = z.boolean();

export const TimezoneInput = NonBlankString;

export const ParentIdInput = z.union([NonBlankString, z.number()]);

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
