import { allOperators } from '@forestadmin/datasource-toolkit';

import { z } from './zod-openapi';
import { MAX_FILTER_DEPTH } from '../validation/capabilities-validator';

const OPERATORS = [...allOperators] as [string, ...string[]];

const ConditionTreeLeafSchema = z
  .object({
    field: z.string(),
    operator: z.enum(OPERATORS),
    value: z.unknown().optional(),
  })
  .openapi('ConditionTreeLeaf', {
    description:
      'A single condition. `operator` is PascalCase and must be one the target field supports; ' +
      'an unsupported one returns 400 invalid_filter_operator listing the valid operators.',
  });

const ConditionTreeSchema: z.ZodType = z
  .lazy(() =>
    z.union([
      ConditionTreeLeafSchema,
      z.object({
        aggregator: z.enum(['And', 'Or']),
        conditions: z.array(ConditionTreeSchema),
      }),
    ]),
  )
  .openapi('ConditionTree', {
    description:
      'Either a leaf condition or a branch nesting more conditions. A branch must carry its ' +
      '`aggregator`: the BFF forwards a branch without one, but the agent then parses it as ' +
      'neither leaf nor branch and answers 400. On top-level list and count, nesting deeper ' +
      `than ${MAX_FILTER_DEPTH} levels is rejected and each field is checked against the ` +
      'collection capabilities; relation list and count forward the filter without either check.',
  });

const SortClauseSchema = z
  .object({
    field: z.string(),
    direction: z.enum(['asc', 'desc']).optional(),
  })
  .openapi('SortClause', { description: 'Omitting `direction` sorts ascending.' });

const PageSchema = z
  .object({
    limit: z.number().int().positive(),
    offset: z.number().int().nonnegative(),
  })
  .openapi('Page', {
    description:
      'The agent paginates by page number, so `offset` must be a whole multiple of `limit`. ' +
      'Any other offset is rejected with 400 invalid_request.',
  });

const TimezoneSchema = z.string().openapi({
  description:
    'Used when the X-Forest-Timezone header is absent. The header wins when both are sent. A ' +
    'deployment with no configured default rejects a request carrying neither with 400 ' +
    'missing_timezone.',
});

export const ListRequestSchema = z
  .object({
    filter: ConditionTreeSchema.optional(),
    projection: z.array(z.string()).optional(),
    sort: z.array(SortClauseSchema).optional(),
    page: PageSchema.optional(),
    timezone: TimezoneSchema.optional(),
  })
  .openapi('ListRequest');

export const CountRequestSchema = z
  .object({
    filter: ConditionTreeSchema.optional(),
    timezone: TimezoneSchema.optional(),
  })
  .openapi('CountRequest');

const ParentIdSchema = z.union([z.string().regex(/\S/), z.number()]).openapi('ParentId', {
  description:
    'The parent record id, opaque: a composite or packed id must be passed unchanged. A ' +
    'blank string is rejected.',
});

export const RelationListRequestSchema = ListRequestSchema.extend({
  parentId: ParentIdSchema,
}).openapi('RelationListRequest', {
  description:
    'Filter, sort and projection apply to the FOREIGN collection; the parent only resolves ' +
    'which records are related.',
});

export const RelationCountRequestSchema = CountRequestSchema.extend({
  parentId: ParentIdSchema,
}).openapi('RelationCountRequest');

export const ActionRequestSchema = z
  .object({
    recordIds: z.array(z.union([z.string(), z.number()])),
    values: z.record(z.string(), z.unknown()).optional(),
    timezone: TimezoneSchema.optional(),
  })
  .openapi('ActionRequest', {
    description:
      '`recordIds` is required, even on a global action: send an empty array when the action ' +
      'targets no record. Every id is coerced to a string before reaching the agent.',
  });

const ForestRecordMetaSchema = z
  .object({
    collection: z.string(),
    primaryKey: z.record(z.string(), z.union([z.string(), z.number()])),
  })
  .openapi('ForestRecordMeta', {
    description:
      'The record identity, unpacked from the agent id. A composite primary key carries one ' +
      'entry per column.',
  });

export const ListResponseSchema = z
  .object({
    data: z.array(
      z.record(z.string(), z.unknown()).and(z.object({ __forest: ForestRecordMetaSchema })),
    ),
    meta: z.object({ countStatus: z.literal('not_requested') }),
  })
  .openapi('ListResponse', {
    description:
      'Records are flat, each carrying a `__forest` envelope. The list never carries a total: ' +
      'call the count endpoint for that, which is why `countStatus` is always `not_requested`.',
  });

export const CountResponseSchema = z
  .union([
    z.object({ count: z.number(), countStatus: z.literal('available') }),
    z.object({ count: z.null(), countStatus: z.literal('deactivated') }),
  ])
  .openapi('CountResponse', {
    description:
      'Two shapes only: a number with `available`, or null with `deactivated` when the ' +
      'collection disables count. The pair never disagrees.',
  });

export const ErrorResponseSchema = z
  .object({
    error: z.object({
      type: z.string(),
      status: z.number().int(),
      message: z.string(),
      details: z.unknown().optional(),
    }),
  })
  .openapi('ErrorResponse');

export const MessagelessErrorResponseSchema = z
  .object({
    error: z.object({
      type: z.string(),
      status: z.number().int(),
      details: z.unknown().optional(),
    }),
  })
  .openapi('MessagelessErrorResponse', {
    description:
      'The unsupported-action-result body, which carries no message field unlike every other error.',
  });

export { ConditionTreeSchema, OPERATORS };
