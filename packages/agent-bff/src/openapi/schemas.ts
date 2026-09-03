import { allOperators } from '@forestadmin/datasource-toolkit';

import { z } from './zod-openapi';
import {
  CountFlatInputs,
  ListFlatInputs,
  PageInput,
  ParentIdInput,
  RelationCountFlatInputs,
  RelationListFlatInputs,
  SearchExtendedInput,
  SearchInput,
  SortClauseInput,
  TimezoneInput,
} from '../data/request-schemas';
import { DISPLAY_HINT_FINALITY } from '../permissions/build-permission-hints';
import { RELATIONSHIP_TYPES } from '../read-model/read-model';
import { MAX_FILTER_DEPTH } from '../validation/capabilities-validator';

const OPERATORS = [...allOperators] as [string, ...string[]];

const ConditionTreeLeafSchema = z
  .strictObject({
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
      z.strictObject({
        aggregator: z.enum(['And', 'Or']),
        conditions: z.array(ConditionTreeSchema),
      }),
      z.strictObject({}),
    ]),
  )
  .openapi('ConditionTree', {
    description:
      'Either a leaf condition, a branch nesting more conditions, or the empty object, which is ' +
      'how an absent filter is spelled. A branch must carry its ' +
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
    'Any other offset is rejected with 400 invalid_request. `limit` and `offset` are both ' +
    'required once `page` is sent, but the object itself is optional on every list — and ' +
    'omitting it is not a request for the whole collection. The BFF then forwards no ' +
    'pagination, so the agent applies its own default: the first page (offset 0), a limit ' +
    'of 15 records on the Node agent. Anything past that page is silently missing. Send ' +
    '`page` and walk it to read a collection in full.',
});

export const TimezoneSchema = TimezoneInput.openapi('Timezone', {
  description:
    'Used when the X-Forest-Timezone header is absent. The header wins when both are sent, but ' +
    'the key is still validated: on a list or count body a blank or whitespace-only string is ' +
    'rejected with 400 even when the header carries a usable zone. An action body is read ' +
    'without that validation, so a blank one there falls back to the header or the default ' +
    'instead. A deployment with no configured default rejects a request carrying neither with ' +
    '400 missing_timezone.',
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

const ParentIdSchema = ParentIdInput.openapi('ParentId', {
  description:
    'The parent record id, opaque: a composite or packed id must be passed unchanged. A ' +
    'blank string is rejected.',
});

export const CLOSED_BODY_NOTE =
  'The runtime rejects an undeclared key with 400 invalid_request, at the top level and inside ' +
  'the filter tree alike: `filters` instead of `filter` is an error rather than a silently ' +
  'unfiltered result, and a leaf carrying `valu` instead of `value` is rejected rather than run ' +
  'with its value dropped.';

type OverridesOf<S extends { shape: object }> = Partial<Record<keyof S['shape'], z.ZodType>>;

const countOverrides = {
  filter: ConditionTreeSchema.optional(),
  search: SearchSchema.optional(),
  searchExtended: SearchExtendedSchema.optional(),
  timezone: TimezoneSchema.optional(),
} satisfies OverridesOf<typeof CountFlatInputs>;

const listOverrides = {
  ...countOverrides,
  sort: z.array(SortClauseSchema).optional(),
  page: PageSchema.optional(),
} satisfies OverridesOf<typeof ListFlatInputs>;

export const ListRequestSchema = ListFlatInputs.extend(listOverrides).openapi('ListRequest', {
  description: CLOSED_BODY_NOTE,
});

export const CountRequestSchema = CountFlatInputs.extend(countOverrides).openapi('CountRequest', {
  description:
    'Accepts the same search inputs as list, so a client can count exactly the rows its search ' +
    `returns. ${CLOSED_BODY_NOTE}`,
});

const relationListOverrides = {
  ...listOverrides,
  parentId: ParentIdSchema,
} satisfies OverridesOf<typeof RelationListFlatInputs>;

const relationCountOverrides = {
  ...countOverrides,
  parentId: ParentIdSchema,
} satisfies OverridesOf<typeof RelationCountFlatInputs>;

export const RelationListRequestSchema = RelationListFlatInputs.extend(
  relationListOverrides,
).openapi('RelationListRequest', {
  description:
    'Filter, sort, projection and search apply to the FOREIGN collection; the parent only ' +
    `resolves which records are related. ${CLOSED_BODY_NOTE}`,
});

export const RelationCountRequestSchema = RelationCountFlatInputs.extend(
  relationCountOverrides,
).openapi('RelationCountRequest', { description: CLOSED_BODY_NOTE });

export const ActionRequestSchema = z
  .strictObject({
    recordIds: z.array(z.union([z.string(), z.number()])),
    values: z.record(z.string(), z.unknown()).optional(),
    timezone: TimezoneSchema.optional(),
  })
  .openapi('ActionRequest', {
    description:
      '`recordIds` is required, even on a global action: send an empty array when the action ' +
      'targets no record. Every id is coerced to a string before reaching the agent. On execute ' +
      'the submitted values are validated against the live form: a required field left empty ' +
      'answers 400, an out-of-enum or wrongly typed value 422. Only the JSON type and an Enum ' +
      "field's options are checked there: a declared string format (date-time, uuid) and a " +
      "widget's own option list are not.",
  });

const UNTRUSTED_HTML_NOTE = 'sanitize it before rendering (stored/reflected XSS risk)';

const ActionFormResponseFieldSchema = z
  .object({
    name: z.string(),
    type: z.union([z.string(), z.array(z.string()).min(1).max(1)]),
    value: z.unknown().optional(),
    isRequired: z.boolean(),
    enumValues: z.union([z.array(z.string()), z.null()]).optional(),
  })
  .openapi('ActionFormResponseField', {
    description:
      'A form field with its current value. `value` is the resolved value at load time: absent ' +
      'when the field carries none (the resolved value was undefined), an explicit null is ' +
      'serialized as null. `enumValues` is present only on an Enum field, and null when the ' +
      'agent declares no options.',
  });

export const ActionFormResponseSchema = z
  .object({
    fields: z.array(ActionFormResponseFieldSchema),
    canExecute: z.boolean(),
    requiredFields: z.array(z.string()),
    skippedFields: z.array(z.string()),
    layout: z.array(z.unknown()),
  })
  .openapi('ActionFormResponse', {
    description:
      'The loaded form. `canExecute` is true only when every required field already carries a ' +
      'value: a null or absent value counts as missing, an explicit empty string or 0 as ' +
      'present. ' +
      '`requiredFields` names the required fields still missing a value. `skippedFields` names ' +
      'the submitted fields the static form does not carry; the same names are rejected with 400 ' +
      'on execute. `layout` is the agent layout tree relayed verbatim (pages, rows, separators, ' +
      'HTML blocks and field references, discriminated by `component`); it is the agent own ' +
      'contract, so it is left untyped here.',
  });

const ActionResultSuccessSchema = z
  .object({
    type: z.literal('success'),
    message: z.union([z.string(), z.null()]),
    invalidated: z.array(z.string()),
    html: z
      .union([z.string(), z.null()])
      .describe(
        `Untrusted HTML relayed verbatim from the agent result: ${UNTRUSTED_HTML_NOTE}. Null ` +
          'when the result carries none.',
      ),
  })
  .openapi('ActionResultSuccess', {
    description:
      'The action ran. `invalidated` names the relations of the acted-on collection whose ' +
      'Related Data should be re-fetched — the agent fills it from ' +
      '`resultBuilder.success(message, { invalidated })` and the BFF relays it from the agent ' +
      '`refresh.relationships`. `message` is the agent wording: an agent-nodejs success with ' +
      'no message serializes the empty string, so null means the agent omitted `success` ' +
      'entirely.',
  });

const ActionResultWebhookSchema = z
  .object({
    type: z.literal('webhook'),
    url: z.string(),
    method: z.string(),
    headers: z.unknown().optional(),
    body: z.unknown().optional(),
  })
  .openapi('ActionResultWebhook', {
    description:
      'The action asks the caller to fire an HTTP request. `headers` and `body` are relayed ' +
      'from the agent payload: absent when it omitted them, an explicit null relayed as null.',
  });

const ActionResultRedirectSchema = z
  .object({
    type: z.literal('redirect'),
    path: z.string(),
  })
  .openapi('ActionResultRedirect', {
    description: 'The action asks the caller to navigate to `path`, relayed verbatim.',
  });

export const ActionResultSchema = z
  .discriminatedUnion('type', [
    ActionResultSuccessSchema,
    ActionResultWebhookSchema,
    ActionResultRedirectSchema,
  ])
  .openapi('ActionResult', {
    description:
      'The normalized execute result, discriminated by `type`. These three are the only 200 ' +
      'bodies: a result the BFF cannot normalize answers 501 instead (see the execute 501 ' +
      'response), and a form the agent rejects answers 400 action_error.',
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
      'call the count endpoint for that, which is why `countStatus` is always `not_requested`. ' +
      'It is always one page, not guaranteed to be the whole collection: a request that omitted ' +
      "`page` still gets a page, the agent's default (up to 15 records from the start on the " +
      'Node agent), so a response of exactly that default length is probably truncated, and ' +
      'nothing in the body says so. Send `page` and walk it. Count gives the total unless the ' +
      'collection disables it.',
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

const CrudHintsSchema = z
  .object({
    browse: z.boolean(),
    read: z.boolean(),
    edit: z.boolean(),
    add: z.boolean(),
    delete: z.boolean(),
    export: z.boolean(),
  })
  .openapi('CrudHints', {
    description:
      'The six collection-level rights of the caller role, as Forest states them. `browse` false ' +
      'does not remove the collection from this response, nor from the schema contract. On a ' +
      'development environment all six are true whatever the role, so an all-true block is not a ' +
      'statement about the role.',
  });

const ActionHintsSchema = z
  .object({
    collection: z.string(),
    name: z.string(),
    visible: z.boolean(),
    requiresApprovalHint: z.boolean(),
    canApproveHint: z.boolean(),
    canSelfApproveHint: z.boolean(),
    finality: z.literal(DISPLAY_HINT_FINALITY),
  })
  .openapi('ActionHints', {
    description:
      'Display hints for one action. `visible` is the trigger right, so it is what gates showing ' +
      'the button; `requiresApprovalHint` says a trigger by this role opens an approval request ' +
      'instead of running, and the two approval flags say whether this role may approve such a ' +
      'request, and its own. `collection` and `name` repeat the keys of the enclosing objects, so ' +
      'a flattened list stays self-describing. On a development environment every exposed action ' +
      'is visible with all three approval flags false, whatever the role. `finality` is always ' +
      `\`${DISPLAY_HINT_FINALITY}\`: it marks the whole payload as UI advice.`,
  });

export const PermissionHintsSchema = z
  .object({
    collections: z.record(
      z.string(),
      z.object({ crud: CrudHintsSchema, actions: z.record(z.string(), ActionHintsSchema) }),
    ),
    visibleActions: z.array(z.object({ collection: z.string(), name: z.string() })),
  })
  .openapi('PermissionHints', {
    description:
      'What the caller may see and do, **as display hints only** — gray out a button, hide a ' +
      'column. Never an authorization decision: the agent re-checks the caller on every proxied ' +
      'call, so a hint reading true grants nothing and a client must still handle 403. ' +
      '`collections` is keyed by the exact schema collection name, and `actions` by the exact ' +
      'action name — only the actions the schema exposes with an endpoint, so an action absent ' +
      'here is not a permission answer. `visibleActions` flattens the actions whose `visible` is ' +
      'true, so a client can build its menu without walking `collections`. The hints describe the ' +
      'caller role alone, and say nothing about record-level scopes.',
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
  .openapi('ErrorResponse', {
    description:
      'The error envelope. `details` is left untyped because its shape depends on `type`: ' +
      '`{ field }` on unknown_field and field_not_filterable, `{ field, validOperators }` on ' +
      'invalid_filter_operator, `{ maxDepth }` on filter_too_deep, `{ fields }` on ' +
      'relation_field_not_supported, and, when the agent supplies them, ' +
      '`{ roleIdsAllowedToApprove }` on action_requires_approval and `{ html }` on action_error. ' +
      'An error forwarded from the agent carries the agent own payload instead, and any other ' +
      'type carries no `details` at all. The action_error html is untrusted agent output relayed ' +
      `verbatim: ${UNTRUSTED_HTML_NOTE}, exactly like the execute success html.`,
  });

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
