import type ComponentPool from './component-pool';
import type { Namer } from './names';
import type {
  CollectionFields,
  UnfoldedAction,
  UnfoldedCollection,
  UnfoldedRelation,
  Unfolding,
} from './unfolding';
import type { z } from './zod-openapi';
import type { PrimaryKeyField } from '../read-model/read-model';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import type { ReferenceObject, SchemaObject } from 'openapi3-ts/oas31';

import toFieldSchema from './field-schemas';
import createNamer, { quoted } from './names';
import recordSchema, { listResponseSchema } from './record-schemas';
import {
  ActionFormResponseSchema,
  ActionResultSchema,
  CLOSED_BODY_NOTE,
  CountResponseSchema,
  ForestRecordMetaSchema,
  ListResponseSchema,
  PageSchema,
  ParentIdSchema,
  SearchExtendedSchema,
  SearchSchema,
  SortClauseSchema,
  TimezoneSchema,
} from './schemas';
import filterSchema, { isFieldSetKnown } from './unfolded-filter-schema';
import { NON_BLANK_PATTERN } from '../data/request-schemas';
import { enumOptionsOf } from '../read-model/field-type';

const DEGRADED_NOTE: Record<NonNullable<CollectionFields['degraded']>, string> = {
  capabilities_unavailable:
    'The field names are NOT enumerated here: the agent could not be asked for this ' +
    "collection's capabilities when the document was built. Any field the collection really " +
    'exposes is still accepted.',
  no_fields:
    'The field names are NOT enumerated here: the agent reports no filterable or projectable ' +
    'field on this collection. Any field sent in `projection`, `sort` or `filter` is therefore ' +
    'rejected with 422 unknown_field — call this path without them.',
};

interface RequestRefs {
  list: ReferenceObject;
  count: ReferenceObject;
}

type BodyProperties = Record<string, ReferenceObject | SchemaObject>;

interface RequestProperties {
  list: BodyProperties;
  count: BodyProperties;
}

interface CollectionPlan {
  collection: UnfoldedCollection;
  key: string;
  requests: RequestRefs;
  /** Carried on the plan so a relation list answers with the FOREIGN collection's own shape. */
  response: ReferenceObject;
  properties: RequestProperties;
}

interface Deps {
  registry: OpenAPIRegistry;
  pool: ComponentPool;
  prefix: string;
  security: Record<string, string[]>[];
  timezoneHeader: z.ZodType[];
  errorResponses: (executeResults: boolean) => Record<string, ReferenceObject>;
}

// A name reaches the runtime through decodeURIComponent, so the document must carry it encoded —
// including the separators that would otherwise change the route, such as a slash inside an action
// name (`a/b` is reachable only as `a%2Fb`).
function segment(name: string): string {
  return encodeURIComponent(name);
}

function fieldsEnum(
  pool: ComponentPool,
  name: string,
  fields: string[],
  description: string,
): SchemaObject | ReferenceObject {
  // An empty enum would forbid every value, so a collection with no known field set keeps a plain
  // string — the runtime is the one that rejects an unknown field, and it says which.
  if (fields.length === 0) return { type: 'string' };

  return pool.add(name, { type: 'string', enum: fields, description });
}

interface FieldRefs {
  projectable: ReferenceObject | SchemaObject;
  filter: ReferenceObject;
  sort: ReferenceObject | SchemaObject;
  anySortable: boolean;
  anyProjectable: boolean;
}

function fieldRefs(deps: Deps, plan: Pick<CollectionPlan, 'key' | 'collection'>): FieldRefs {
  const { pool } = deps;
  const { name, fields } = plan.collection;

  const projectable = fieldsEnum(
    pool,
    `Fields_${plan.key}`,
    fields.projectable.map(field => field.name),
    `A field of ${quoted(name)}.`,
  );

  // Sortable is a subset of projectable too, but only the v1 synthesis ever narrows it: a field the
  // apimap marks not sortable is projectable and filterable while a sort on it answers 422
  // field_not_sortable. The enum is shared with projectable when nothing is denied, which is every
  // v2 collection, so the common document gains no component.
  const sortableNames = fields.projectable
    .filter(field => field.sortable !== false)
    .map(field => field.name);

  const sortableField =
    sortableNames.length === fields.projectable.length
      ? projectable
      : fieldsEnum(
          pool,
          `SortableFields_${plan.key}`,
          sortableNames,
          `A sortable field of ${quoted(name)}.`,
        );

  // Filterable is a strict subset of projectable: the agent reports a ManyToOne without operators, so
  // projecting or sorting on it works while filtering on it answers 422 field_not_filterable. Which is
  // why the filterable fields are not enumerated here but inside the filter leaves, where each one
  // sits next to the operators it actually supports.
  return {
    projectable,
    filter: filterSchema(deps, plan),
    // Same split as the filter leaves: an UNKNOWN field set leaves sort unconstrained, because the
    // runtime is the one that rejects. A known set with nothing sortable — every field denied, or
    // capabilities naming no field at all — is a collection that takes no clause.
    anySortable: sortableNames.length > 0 || !isFieldSetKnown(fields),
    anyProjectable: fields.projectable.length > 0 || !isFieldSetKnown(fields),
    sort:
      sortableNames.length === 0
        ? pool.reuse('SortClause', SortClauseSchema)
        : pool.add(`SortClause_${plan.key}`, {
            type: 'object',
            description: 'Omitting `direction` sorts ascending.',
            properties: {
              field: sortableField,
              direction: { type: 'string', enum: ['asc', 'desc'] },
            },
            required: ['field'],
            additionalProperties: false,
          }),
  };
}

function requestDescription(collection: UnfoldedCollection, subject: string): string {
  const note = collection.fields.degraded ? ` ${DEGRADED_NOTE[collection.fields.degraded]}` : '';

  return `${subject}${note} ${CLOSED_BODY_NOTE}`;
}

function requestProperties(deps: Deps, plan: Pick<CollectionPlan, 'key' | 'collection'>) {
  const { pool } = deps;
  const refs = fieldRefs(deps, plan);
  const timezone = pool.reuse('Timezone', TimezoneSchema);
  const search = pool.reuse('Search', SearchSchema);
  const searchExtended = pool.reuse('SearchExtended', SearchExtendedSchema);
  const count: BodyProperties = { filter: refs.filter, search, searchExtended, timezone };

  return {
    count,
    list: {
      filter: refs.filter,
      // Same cap as sort, on the same split: capabilities that were READ and name no field leave
      // nothing to project, and `fieldsEnum` falls back to an unrestricted string for an empty
      // list, which would advertise every field while each request answers 422 unknown_field. An
      // UNKNOWN field set stays uncapped — the collection still projects whatever it exposes.
      projection: refs.anyProjectable
        ? { type: 'array', items: refs.projectable }
        : {
            type: 'array',
            items: refs.projectable,
            maxItems: 0,
            description: 'This collection exposes no field: send an empty array, or omit it.',
          },
      // A collection whose every known field is denied sorting takes no clause at all: the shared
      // SortClause leaves `field` an unrestricted string, which would advertise every field as
      // sortable while each request answers 422 field_not_sortable. `maxItems: 0` says what the
      // runtime does — an empty sort passes, any clause does not.
      sort: refs.anySortable
        ? { type: 'array', items: refs.sort }
        : {
            type: 'array',
            items: refs.sort,
            maxItems: 0,
            description:
              'No field of this collection is sortable: send an empty array, or omit it.',
          },
      page: pool.reuse('Page', PageSchema),
      search,
      searchExtended,
      timezone,
    } satisfies BodyProperties,
  };
}

function registerRequests(
  deps: Deps,
  plan: Pick<CollectionPlan, 'key' | 'collection'>,
  properties: RequestProperties,
): RequestRefs {
  const { pool } = deps;
  const { collection, key } = plan;

  return {
    list: pool.add(`ListRequest_${key}`, {
      type: 'object',
      description: requestDescription(
        collection,
        `Filter, search, sort and project records of ${quoted(collection.name)}.`,
      ),
      properties: properties.list,
      additionalProperties: false,
    }),
    count: pool.add(`CountRequest_${key}`, {
      type: 'object',
      description: requestDescription(
        collection,
        `Count records of ${quoted(collection.name)}. Accepts the same search inputs as list, so ` +
          'a client can count exactly the rows its search returns.',
      ),
      properties: properties.count,
      additionalProperties: false,
    }),
  };
}

/**
 * A collection whose field set could not be read keeps the shared untyped response: a record schema
 * built from an empty projectable set would claim the record holds nothing but `id` and `__forest`.
 */
function registerListResponse(
  deps: Deps,
  plan: Pick<CollectionPlan, 'collection' | 'key'>,
): ReferenceObject {
  const { pool } = deps;
  const { collection, key } = plan;

  if (collection.fields.projectable.length === 0) {
    return pool.reuse('ListResponse', ListResponseSchema);
  }

  const record = pool.add(
    `Record_${key}`,
    recordSchema(collection, pool.reuse('ForestRecordMeta', ForestRecordMetaSchema)),
  );

  return pool.add(`ListResponse_${key}`, listResponseSchema(collection, record));
}

const PARENT_ID_SHAPE = {
  anyOf: [{ type: 'string' as const, pattern: NON_BLANK_PATTERN }, { type: 'number' as const }],
};

/**
 * `parentId` is opaque on the wire: `parseParentId` takes a non-blank string or a finite number
 * whatever the key's type is, and forwards it to the agent as a string. So the SHAPE stays that
 * union — narrowing a numeric key to `number` would make a generated client reject `"123"`, which
 * the endpoint accepts. What the read-model knows goes in the description: which column the id
 * belongs to, and, for a composite key, that it is packed in the agent's own format.
 */
function parentIdSchema(
  pool: ComponentPool,
  parent: string,
  primaryKeys: PrimaryKeyField[],
): ReferenceObject | SchemaObject {
  if (primaryKeys.length === 0) return pool.reuse('ParentId', ParentIdSchema);

  if (primaryKeys.length > 1) {
    return {
      // A composite id only works as its packed string: a number could never carry the separator.
      type: 'string',
      pattern: NON_BLANK_PATTERN,
      // The order the keys are published in is not the order the agent packs them in, so naming one
      // would send a client to build an id the agent unpacks onto the wrong columns.
      description:
        `The composite id of the parent ${quoted(parent)} record, taken verbatim from that ` +
        `record's own id: the values of ${primaryKeys.map(key => key.name).join(', ')} packed ` +
        `in the agent's own format and order. Copy it from a listed record rather than ` +
        `assembling it.`,
    };
  }

  const [key] = primaryKeys;

  // A DERIVED key names no verified column: the schema published no key, so the read-model guessed
  // one from an `id` field, or invented the name outright. Stating `(id, String)` the way a declared
  // key is stated would contradict `ForestRecordMeta`, which warns in the same document that this
  // `id` may not be a column at all. The shape is unaffected — the wire takes the id opaque either
  // way — so only the description hedges.
  const column = key.derived
    ? 'its primary key is not published by the schema, so this is the opaque agent id, which is ' +
      `NOT necessarily the value of a column named ${quoted(key.name)}`
    : `${key.name}, ${key.type}`;

  return {
    ...PARENT_ID_SHAPE,
    description:
      `The parent ${quoted(parent)} record id (${column}). A number or its ` +
      'string form are both accepted; the Gateway API forwards it to the agent as a string.',
  };
}

function registerRelationRequests(
  deps: Deps,
  plan: CollectionPlan,
  relation: UnfoldedRelation,
  relationKey: string,
  foreign: CollectionPlan,
): RequestRefs {
  const { pool } = deps;
  const parentId = parentIdSchema(pool, plan.collection.name, plan.collection.primaryKeys);
  const { degraded } = foreign.collection.fields;
  const foreignNote = degraded ? ` ${DEGRADED_NOTE[degraded]}` : '';
  const appliesTo =
    `apply to ${quoted(foreign.collection.name)}, the foreign collection of ` +
    `${quoted(plan.collection.name)}.${quoted(relation.name)}; the parent only resolves which ` +
    'records are related.';

  const body = (inputs: 'list' | 'count', subject: string): SchemaObject => ({
    type: 'object',
    description: `${subject} ${appliesTo}${foreignNote} ${CLOSED_BODY_NOTE}`,
    properties: { ...foreign.properties[inputs], parentId },
    required: ['parentId'],
    additionalProperties: false,
  });

  return {
    list: pool.add(
      `RelationListRequest_${relationKey}`,
      body('list', 'Filter, sort, projection and search'),
    ),
    count: pool.add(`RelationCountRequest_${relationKey}`, body('count', 'Filter and search')),
  };
}

function actionFieldBaseSchema(field: UnfoldedAction['fields'][number]): SchemaObject {
  if (field.reference !== null) {
    return { type: 'string', description: `A packed record id for ${field.reference}.` };
  }

  const options = enumOptionsOf(field.type, field.enums);

  if (options === undefined) return toFieldSchema(field.type);

  return Array.isArray(field.type)
    ? { type: 'array', items: { type: 'string', enum: options } }
    : { type: 'string', enum: options };
}

function actionFieldSchema(field: UnfoldedAction['fields'][number]): SchemaObject {
  const base = actionFieldBaseSchema(field);

  if (!field.isRequired) return base;

  const required = 'The agent declares this field required on the static form.';

  return {
    ...base,
    description: base.description === undefined ? required : `${base.description} ${required}`,
  };
}

function actionValuesSchema(action: UnfoldedAction): SchemaObject {
  return {
    type: 'object',
    // No property is required and no additional one is forbidden on purpose: a load or change hook
    // rebuilds the form at call time, so the schema's static fields are an indication, not the
    // contract — and the read-model cannot tell a hookless action from a legacy schema that simply
    // omitted its hooks, so "static" is never certain.
    description:
      'The submitted action fields. These are the fields the schema declares statically; a load ' +
      'or change hook can add, drop or require others at call time. On execute the values are ' +
      'validated against that live form: a required field left empty answers 400, an out-of-enum ' +
      "or wrongly typed value 422. Only the JSON type and an Enum field's options are checked " +
      "there: a declared string format (date-time, uuid) and a widget's own option list are not.",
    properties: Object.fromEntries(
      action.fields.map(field => [field.name, actionFieldSchema(field)]),
    ),
  };
}

function registerActionRequest(
  deps: Deps,
  plan: CollectionPlan,
  action: UnfoldedAction,
  actionKey: string,
): ReferenceObject {
  const { pool } = deps;

  return pool.add(`ActionRequest_${actionKey}`, {
    type: 'object',
    description:
      `The body of action ${quoted(action.name)} on ${quoted(plan.collection.name)}. ` +
      '`recordIds` is required even on a global action: send an empty array when the action ' +
      'targets no record.',
    properties: {
      recordIds: { type: 'array', items: { anyOf: [{ type: 'string' }, { type: 'number' }] } },
      values: actionValuesSchema(action),
      timezone: pool.reuse('Timezone', TimezoneSchema),
    },
    required: ['recordIds'],
    additionalProperties: false,
  });
}

interface OperationOptions {
  path: string;
  operationId: string;
  /**
   * The collection the operation belongs to, verbatim. Untagged, an unfolded document renders as one
   * flat list of every operation — hundreds of entries on a real schema — because a viewer has no
   * other structure to group by. The relation and action operations take their PARENT collection, so
   * a group answers "what can I do with this collection", which is how a reader arrives.
   */
  tag: string;
  summary: string;
  description: string;
  request: ReferenceObject;
  response: ReferenceObject | SchemaObject;
  responseDescription: string;
  bodyRequired: boolean;
  executeResults?: boolean;
}

function registerOperation(deps: Deps, options: OperationOptions): void {
  deps.registry.registerPath({
    method: 'post',
    path: `${deps.prefix}/${options.path}`,
    operationId: options.operationId,
    tags: [options.tag],
    summary: options.summary,
    description: options.description,
    security: deps.security,
    request: {
      headers: deps.timezoneHeader,
      body: {
        required: options.bodyRequired,
        content: { 'application/json': { schema: options.request } },
      },
    },
    responses: {
      200: {
        description: options.responseDescription,
        content: { 'application/json': { schema: options.response } },
      },
      ...deps.errorResponses(options.executeResults === true),
    },
  });
}

function registerCollectionOperations(deps: Deps, plan: CollectionPlan): void {
  const { pool } = deps;
  const { name } = plan.collection;
  const countResponse = pool.reuse('CountResponse', CountResponseSchema);

  registerOperation(deps, {
    path: `${segment(name)}/list`,
    operationId: `listRecords_${plan.key}`,
    tag: name,
    summary: `List records of ${name}`,
    description: `Lists records of the ${quoted(name)} collection.`,
    request: plan.requests.list,
    response: plan.response,
    responseDescription: `A page of ${quoted(name)} records`,
    bodyRequired: false,
  });

  registerOperation(deps, {
    path: `${segment(name)}/count`,
    operationId: `countRecords_${plan.key}`,
    tag: name,
    summary: `Count records of ${name}`,
    description: `Counts records of the ${quoted(name)} collection.`,
    request: plan.requests.count,
    response: countResponse,
    responseDescription: `The matching ${quoted(name)} record count`,
    bodyRequired: false,
  });
}

function registerRelationOperations(
  deps: Deps,
  plan: CollectionPlan,
  plansByName: Map<string, CollectionPlan>,
  namer: Namer,
): void {
  const { pool } = deps;

  plan.collection.relations.forEach(relation => {
    const foreign = plansByName.get(relation.foreignCollection);
    if (!foreign) return;

    const relationKey = namer(`${plan.key}_${relation.name}`);
    const requests = registerRelationRequests(deps, plan, relation, relationKey, foreign);
    const parent = `${quoted(plan.collection.name)}.${quoted(relation.name)}`;

    registerOperation(deps, {
      path: `${segment(plan.collection.name)}/relations/${segment(relation.name)}/list`,
      operationId: `listRelatedRecords_${relationKey}`,
      tag: plan.collection.name,
      summary: `List ${relation.name} of ${plan.collection.name}`,
      description: `Lists the ${quoted(foreign.collection.name)} records related to a ${quoted(
        plan.collection.name,
      )} record through ${parent}.`,
      request: requests.list,
      response: foreign.response,
      responseDescription: `A page of related ${quoted(foreign.collection.name)} records`,
      bodyRequired: true,
    });

    registerOperation(deps, {
      path: `${segment(plan.collection.name)}/relations/${segment(relation.name)}/count`,
      operationId: `countRelatedRecords_${relationKey}`,
      tag: plan.collection.name,
      summary: `Count ${relation.name} of ${plan.collection.name}`,
      description: `Counts the ${quoted(
        foreign.collection.name,
      )} records related through ${parent}.`,
      request: requests.count,
      response: pool.reuse('CountResponse', CountResponseSchema),
      responseDescription: `The matching related ${quoted(foreign.collection.name)} record count`,
      bodyRequired: true,
    });
  });
}

function registerActionOperations(deps: Deps, plan: CollectionPlan, namer: Namer): void {
  const { pool } = deps;

  plan.collection.actions.forEach(action => {
    const actionKey = namer(`${plan.key}_${action.name}`);
    const request = registerActionRequest(deps, plan, action, actionKey);
    // The path segment is the exact schema action name, URL-encoded — that is what the middleware
    // decodes and looks up. The operationId is sanitized, so the exact name lives in prose.
    const identity = `The action name is exactly ${quoted(action.name)}.`;
    const base = `${segment(plan.collection.name)}/actions/${segment(action.name)}`;

    registerOperation(deps, {
      path: `${base}/form`,
      operationId: `getActionForm_${actionKey}`,
      tag: plan.collection.name,
      summary: `Load the form of ${action.name} on ${plan.collection.name}`,
      description: `Loads the form of the custom action. ${identity} An unknown submitted field is skipped here, not rejected.`,
      request,
      response: pool.reuse('ActionFormResponse', ActionFormResponseSchema),
      responseDescription:
        'The action form fields; htmlBlock layout content is sanitized server-side against an allowlist before relaying',
      bodyRequired: true,
    });

    registerOperation(deps, {
      path: `${base}/execute`,
      operationId: `executeAction_${actionKey}`,
      tag: plan.collection.name,
      summary: `Execute ${action.name} on ${plan.collection.name}`,
      description: `Executes the custom action. ${identity} A submitted field the loaded form does not carry is rejected with 400.`,
      request,
      response: pool.reuse('ActionResult', ActionResultSchema),
      responseDescription:
        'The normalized action result; a success result html field is sanitized server-side against an allowlist before relaying',
      bodyRequired: true,
      executeResults: true,
    });
  });
}

/**
 * Emits one path per exposed collection, to-many relation and action. The runtime routes stay the
 * generic regexes — only the document unfolds.
 */
export default function registerUnfoldedPaths(deps: Deps, unfolding: Unfolding): void {
  // One namer per identifier family, fed the WHOLE composed name. Deduplicating each segment on its
  // own would not be enough: sanitizing produces `_`, which is also the separator, so collection
  // `A_B` with action `C` and collection `A` with action `B_C` both compose `A_B_C` — one action
  // would then get the other's request schema.
  const collections = createNamer();
  const relations = createNamer();
  const actions = createNamer();

  const plans = unfolding.collections.map(collection => {
    const key = collections(collection.name);

    const properties = requestProperties(deps, { collection, key });

    return {
      collection,
      key,
      properties,
      requests: registerRequests(deps, { collection, key }, properties),
      response: registerListResponse(deps, { collection, key }),
    };
  });
  const plansByName = new Map(plans.map(plan => [plan.collection.name, plan]));

  plans.forEach(plan => {
    registerCollectionOperations(deps, plan);
    registerRelationOperations(deps, plan, plansByName, relations);
    registerActionOperations(deps, plan, actions);
  });
}
