import { allOperators } from '@forestadmin/datasource-toolkit';

import { z } from './zod-openapi';
import {
  MAX_PAGE_LIMIT,
  PageInput,
  ParentIdInput,
  ProjectionInput,
  SearchExtendedInput,
  SearchInput,
  SortClauseInput,
  TimezoneInput,
} from '../data/request-schemas';
import { RELATIONSHIP_TYPES } from '../read-model/read-model';
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

export const SortClauseSchema = SortClauseInput.openapi('SortClause', {
  description: 'Omitting `direction` sorts ascending.',
});

export const PageSchema = PageInput.openapi('Page', {
  description:
    'The agent paginates by page number, so `offset` must be a whole multiple of `limit`. ' +
    `Any other offset is rejected with 400 invalid_request, as is a \`limit\` above \`${MAX_PAGE_LIMIT}\` ` +
    '(the maximum is not clamped silently).',
});

export const TimezoneSchema = TimezoneInput.openapi('Timezone', {
  description:
    'Used when the X-Forest-Timezone header is absent. The header wins when both are sent. A ' +
    'deployment with no configured default rejects a request carrying neither with 400 ' +
    'missing_timezone.',
});

export const SearchSchema = SearchInput.openapi('Search', {
  description:
    "The agent's native full-text search, applied on top of `filter` rather than instead of it. " +
    'An empty or whitespace-only value is treated as absent, so clearing a search box is not an ' +
    'error. Searching a collection whose search is disabled is not rejected here: the agent ' +
    'answers 400 validation_error with "Collection is not searchable". The response does not say ' +
    'which field matched. The value is a query, not a plain term: `column:value` narrows the ' +
    'search to one column, and `relation.column:value` narrows it to a column of a related ' +
    'collection — so a search reaches relation fields on its own, with no `searchExtended`, and ' +
    'escapes the 422 relation_field_not_supported that the same path draws in `filter`, `sort` or ' +
    '`projection`. The agent resolves a relation named in a query against its own schema, so a ' +
    'query can filter on a column of a collection this BFF does not expose.',
});

export const SearchExtendedSchema = SearchExtendedInput.openapi('SearchExtended', {
  description:
    'Widens `search` to every related collection reachable from this one, instead of only this ' +
    "collection's own columns. Meaningless on its own: sent without `search` it is ignored and " +
    'changes nothing. It is not the only way a search reaches a relation — see `Search` for the ' +
    '`relation.column:value` syntax, which does so without this flag.',
});

export const ListRequestSchema = z
  .object({
    filter: ConditionTreeSchema.optional(),
    projection: ProjectionInput.optional(),
    sort: z.array(SortClauseSchema).optional(),
    page: PageSchema.optional(),
    search: SearchSchema.optional(),
    searchExtended: SearchExtendedSchema.optional(),
    timezone: TimezoneSchema.optional(),
  })
  .openapi('ListRequest');

export const CountRequestSchema = z
  .object({
    filter: ConditionTreeSchema.optional(),
    search: SearchSchema.optional(),
    searchExtended: SearchExtendedSchema.optional(),
    timezone: TimezoneSchema.optional(),
  })
  .openapi('CountRequest', {
    description:
      'Accepts the same search inputs as list, so a client can count exactly the rows its search ' +
      'returns.',
  });

const ParentIdSchema = ParentIdInput.openapi('ParentId', {
  description:
    'The parent record id, opaque: a composite or packed id must be passed unchanged. A ' +
    'blank string is rejected.',
});

export const RelationListRequestSchema = ListRequestSchema.extend({
  parentId: ParentIdSchema,
}).openapi('RelationListRequest', {
  description:
    'Filter, sort, projection and search apply to the FOREIGN collection; the parent only resolves ' +
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

const ContextFieldTypeSchema: z.ZodType = z
  .lazy(() =>
    z.union([
      z.string(),
      z.array(ContextFieldTypeSchema),
      z.object({
        fields: z.array(
          z.object({
            field: z.string(),
            type: ContextFieldTypeSchema,
            enums: z.array(z.string()).optional(),
          }),
        ),
      }),
    ]),
  )
  .openapi('ContextFieldType', {
    description:
      'The field type, passed through from the agent wire format without normalization: a string ' +
      'for a primitive, an array of types for an array field, or an object carrying `fields` for ' +
      'a composite. A composite sub-field carries its own `type`, recursively, and its own ' +
      '`enums` when it is an enum. A consumer that only understands primitives should ignore the ' +
      'other two rather than fail.',
  });

const ContextValidationSchema = z
  .object({ type: z.string(), value: z.unknown().optional() })
  .openapi('ContextValidation', {
    description:
      'A validation rule as the agent states it. `type` is the Forest wording (`is like`, `is ' +
      'present`, `is longer than`, …) and `value` is passed through unchanged, so its shape ' +
      'follows the rule: a number for a length rule, a date for a comparison. On `is like` it is ' +
      'the JavaScript **literal** form of the regular expression — slashes included, and flags ' +
      'after the closing one (`/^data:.*;base64,.*/`, but also `/^a|b|c$/g`). Parse it as a ' +
      'literal, splitting on the LAST slash to separate pattern from flags; stripping the outer ' +
      'characters instead leaves the flags inside the pattern, which then matches nothing. A ' +
      'rule with no operand carries no `value`.',
  });

const ContextFieldSchema = z.object({
  field: z.string(),
  type: ContextFieldTypeSchema,
  relationship: z.enum(RELATIONSHIP_TYPES).optional(),
  reference: z.string().optional(),
  inverseOf: z.string().optional(),
  polymorphicTargets: z.array(z.string()).optional(),
  isPrimaryKey: z.boolean().optional(),
  isRequired: z.boolean().optional(),
  isReadOnly: z.boolean().optional(),
  enums: z.array(z.string()).optional(),
  validations: z.array(ContextValidationSchema).optional(),
});

const ContextActionSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['single', 'bulk', 'global']),
  fields: z.array(
    z.object({
      field: z.string(),
      type: ContextFieldTypeSchema,
      isRequired: z.boolean().optional(),
      defaultValue: z.unknown().optional(),
      enums: z.array(z.string()).optional(),
    }),
  ),
});

export const ContextResponseSchema = z
  .object({
    collections: z.array(
      z.object({
        name: z.string(),
        fields: z.array(ContextFieldSchema),
        actions: z.array(ContextActionSchema),
      }),
    ),
    meta: z.object({ schemaRevision: z.number(), environmentId: z.number().optional() }),
  })
  .openapi('ContextResponse', {
    description:
      'Everything the agent schema exposes: collection names, typed fields with their relation ' +
      'markers, and the custom actions that carry an endpoint. Field types are passed through ' +
      'from the agent wire format, so a type is a string, an array of types, or a composite ' +
      'object. A `Binary` column is advertised as `String`, because that is what it is on the ' +
      'wire — the bytes travel as a data uri or as hex — so `type` alone does not tell a text ' +
      'field from an encoded one: read `validations` for that. `reference` keeps the raw agent ' +
      'form, the foreign collection and the key joined by a dot — the collection name may itself ' +
      'contain dots, so drop only the trailing segment to recover it. A target named by ' +
      '`reference` or `polymorphicTargets` is NOT guaranteed to appear in `collections[]`: the ' +
      'schema describes a field as the agent declares it, and a relation can point at a ' +
      'collection this document does not expose. Cross a target against `collections[]` before ' +
      'following it — unlike the per-collection route documents, nothing here is dropped for ' +
      'pointing outside the served set. ' +
      'The document carries no rendering, project or team identity, and the only environment ' +
      'datum is `meta.environmentId` below. It is served to both auth modes — an OAuth session ' +
      'and a BFF API key get the same document. It is NOT filtered by the caller permissions: ' +
      'it describes the whole exposed schema minus the endpoint-less actions, so cross it with ' +
      '`/agent/v1/permissions` to know what the caller may actually ' +
      'see. `meta.schemaRevision` increments whenever the BFF refreshes its schema, and resets ' +
      'when the BFF restarts. `meta.environmentId` is the environment the BFF resolved at boot ' +
      'from its own secret — it is telemetry, not a routing input, and it is absent when the ' +
      'deployment runs without the OAuth configuration.',
  });

export const AiQueryRequestSchema = z.unknown().openapi('AiQueryRequest', {
  description:
    'Passed through to the Forest AI proxy without validation or rewriting, so the authority on ' +
    'this shape is the upstream contract, not the BFF. It is left free-form on purpose: the BFF ' +
    'enforces nothing here, and a shape published from this side would drift from the upstream ' +
    'one nobody keeps it in sync with. In practice it is the OpenAI chat-completion body — ' +
    '`messages`, and optionally `tools`, `tool_choice`, `parallel_tool_calls`. A malformed body ' +
    'is rejected by the Forest server, not here.',
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

export { ConditionTreeSchema, ParentIdSchema, OPERATORS };
