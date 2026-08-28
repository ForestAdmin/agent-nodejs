import type ComponentPool from './component-pool';
import type { Namer } from './names';
import type {
  CollectionFields,
  FilterableField,
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
import createNamer from './names';
import {
  CountResponseSchema,
  ListResponseSchema,
  OPERATORS,
  PageSchema,
  ParentIdSchema,
  SortClauseSchema,
  TimezoneSchema,
} from './schemas';
import { PACKED_ID_SEPARATOR } from '../data/pack-id';

const AGGREGATORS = ['And', 'Or'];

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

interface CollectionPlan {
  collection: UnfoldedCollection;
  key: string;
  requests: RequestRefs;
}

interface Deps {
  registry: OpenAPIRegistry;
  pool: ComponentPool;
  prefix: string;
  security: Record<string, string[]>[];
  timezoneHeader: z.ZodType[];
  errorResponses: (executeResults: boolean) => Record<string, ReferenceObject>;
}

function quoted(name: string): string {
  return JSON.stringify(name);
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

interface OperatorGroup {
  fields: string[];
  operators: string[];
}

/**
 * Groups the filterable fields by the operator set they share. One leaf per field would be as exact
 * but would multiply the document by the field count; the number of distinct operator sets is bounded
 * by the column types a collection really uses, and the cross product of a group is precisely the set
 * of valid `(field, operator)` pairs. The grouping is derived from what capabilities reported — two
 * fields of DIFFERENT types sharing an operator set land in one group, so nothing here is a type
 * table.
 */
function groupByOperators(filterable: FilterableField[]): OperatorGroup[] {
  const groups = new Map<string, OperatorGroup>();

  filterable.forEach(field => {
    // An empty set would emit `enum: []`, which forbids every value and makes the leaf unsatisfiable —
    // the trap `fieldsEnum` guards above. `collectFilterableFields` cannot produce one, but `Unfolding`
    // is hand-constructible plain data, so the generator holds the invariant rather than assume it.
    if (field.operators.length === 0) return;

    // Safe as a key because the operators are normalized to one canonical order at collect time.
    const signature = field.operators.join(',');
    const group = groups.get(signature);

    if (group) group.fields.push(field.name);
    else groups.set(signature, { fields: [field.name], operators: [...field.operators] });
  });

  return [...groups.values()];
}

// A node readable as BOTH a leaf and a branch is rejected with 400 (`agent-query.ts`
// `assertNoNodeReadableAsBothLeafAndBranch`), so each alternative excludes the other's discriminator.
// The exclusion carries the TYPE the runtime looks for — `isBranch` needs an ARRAY `conditions` and
// `isLeaf` a STRING `field` — because `{field, operator, conditions: "x"}` is a plain leaf the runtime
// accepts. Expressed as `not: { required }` rather than `additionalProperties: false`, which would
// also forbid an unknown extra key the runtime strips.
function leafShape(
  field: ReferenceObject | SchemaObject,
  operators: string[],
  description: string,
): SchemaObject {
  return {
    type: 'object',
    description,
    properties: {
      field,
      operator: { type: 'string', enum: operators },
      value: {},
    },
    required: ['field', 'operator'],
    not: { properties: { conditions: { type: 'array' } }, required: ['conditions'] },
  };
}

/**
 * One leaf alternative per operator set. A field absent from `filterable` is in none of them, which is
 * the only honest way to document it: a `ManyToOne` answers 422 field_not_filterable, and a field the
 * collector dropped for an unmappable operator answers 500 mapping_error on every filter.
 */
function filterLeaves(pool: ComponentPool, plan: Pick<CollectionPlan, 'key' | 'collection'>) {
  const { name, fields } = plan.collection;
  const groups = groupByOperators(fields.filterable);

  // No known filterable field: the field stays free-form and every operator stays allowed, because a
  // collection whose capabilities could not be read still accepts whatever it really exposes.
  if (groups.length === 0) {
    return [
      pool.add(
        `FilterLeaf_${plan.key}`,
        leafShape({ type: 'string' }, OPERATORS, `A single condition on ${quoted(name)}.`),
      ),
    ];
  }

  // `-` rather than `_` before the index, and the difference is load-bearing: `sanitizeIdentifier` maps
  // every character outside `[A-Za-z0-9_]` to `_`, so a collection key can end in `_<digit>` — either
  // because the customer named a collection `Invoice 1`, or because `createNamer` suffixed a name that
  // collapsed. With `_`, collection `Invoice 1` (no group, so the bare name below) and collection
  // `Invoice` (first group) both claim `FilterLeaf_Invoice_1`, and `ComponentPool.add` settles it
  // last-wins in silence — one collection would document the other's fields and operators. Sanitizing
  // can never produce a `-`, so this separator makes the two namespaces disjoint by construction.
  return groups.map((group, index) =>
    pool.add(
      `FilterLeaf_${plan.key}-${index + 1}`,
      leafShape(
        { type: 'string', enum: group.fields },
        group.operators,
        `A single condition on ${quoted(name)}. These fields share one operator set, as the ` +
          "collection's capabilities report it.",
      ),
    ),
  );
}

function filterSchema(
  { pool }: Deps,
  plan: Pick<CollectionPlan, 'key' | 'collection'>,
): ReferenceObject {
  const { name, fields } = plan.collection;
  const treeName = `Filter_${plan.key}`;
  const treeRef = { $ref: `#/components/schemas/${treeName}` };
  const leaves = filterLeaves(pool, plan);
  const pairing =
    fields.filterable.length > 0
      ? ' There is one leaf alternative per operator set: a field accepts only the operators of ' +
        'the alternative listing it, and an operator it does not support answers 400 ' +
        'invalid_filter_operator.'
      : '';

  return pool.add(treeName, {
    description:
      `A filter on ${quoted(name)}: either a leaf condition or a branch nesting more ` +
      'conditions. A branch must carry its aggregator. A node carrying both `field` and ' +
      `\`conditions\` is rejected with 400, so the two shapes are mutually exclusive.${pairing}`,
    anyOf: [
      ...leaves,
      {
        type: 'object',
        properties: {
          aggregator: { type: 'string', enum: AGGREGATORS },
          conditions: { type: 'array', items: treeRef },
        },
        required: ['aggregator', 'conditions'],
        not: { properties: { field: { type: 'string' } }, required: ['field'] },
      },
    ],
  });
}

interface FieldRefs {
  projectable: ReferenceObject | SchemaObject;
  filter: ReferenceObject;
  sort: ReferenceObject | SchemaObject;
}

function fieldRefs(deps: Deps, plan: Pick<CollectionPlan, 'key' | 'collection'>): FieldRefs {
  const { pool } = deps;
  const { name, fields } = plan.collection;

  const projectable = fieldsEnum(
    pool,
    `Fields_${plan.key}`,
    fields.projectable,
    `A field of ${quoted(name)}.`,
  );

  // Filterable is a strict subset of projectable: the agent reports a ManyToOne without operators, so
  // projecting or sorting on it works while filtering on it answers 422 field_not_filterable. Which is
  // why the filterable fields are not enumerated here but inside the filter leaves, where each one
  // sits next to the operators it actually supports.
  return {
    projectable,
    filter: filterSchema(deps, plan),
    sort:
      fields.projectable.length === 0
        ? pool.reuse('SortClause', SortClauseSchema)
        : pool.add(`SortClause_${plan.key}`, {
            type: 'object',
            description: 'Omitting `direction` sorts ascending.',
            properties: {
              field: projectable,
              direction: { type: 'string', enum: ['asc', 'desc'] },
            },
            required: ['field'],
          }),
  };
}

function requestDescription(collection: UnfoldedCollection, subject: string): string {
  const note = collection.fields.degraded ? ` ${DEGRADED_NOTE[collection.fields.degraded]}` : '';

  return `${subject}${note}`;
}

function registerRequests(deps: Deps, plan: Omit<CollectionPlan, 'requests'>): RequestRefs {
  const { pool } = deps;
  const { collection, key } = plan;
  const refs = fieldRefs(deps, plan);
  const timezone = pool.reuse('Timezone', TimezoneSchema);

  return {
    list: pool.add(`ListRequest_${key}`, {
      type: 'object',
      description: requestDescription(
        collection,
        `Filter, sort and project records of ${quoted(collection.name)}.`,
      ),
      properties: {
        filter: refs.filter,
        projection: { type: 'array', items: refs.projectable },
        sort: { type: 'array', items: refs.sort },
        page: pool.reuse('Page', PageSchema),
        timezone,
      },
    }),
    count: pool.add(`CountRequest_${key}`, {
      type: 'object',
      description: requestDescription(
        collection,
        `Count records of ${quoted(collection.name)} matching a filter.`,
      ),
      properties: { filter: refs.filter, timezone },
    }),
  };
}

const PARENT_ID_SHAPE = {
  anyOf: [{ type: 'string' as const, pattern: '\\S' }, { type: 'number' as const }],
};

/**
 * `parentId` is opaque on the wire: `parseParentId` takes a non-blank string or a finite number
 * whatever the key's type is, and forwards it to the agent as a string. So the SHAPE stays that
 * union — narrowing a numeric key to `number` would make a generated client reject `"123"`, which
 * the endpoint accepts. What the read-model knows goes in the description: which column the id
 * belongs to, and, for a composite key, the `|`-joined order `unpackPrimaryKey` expects.
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
      pattern: '\\S',
      description:
        `The composite id of the parent ${quoted(parent)} record: the values of ` +
        `${primaryKeys.map(key => key.name).join(', ')} joined by ` +
        `${quoted(PACKED_ID_SEPARATOR)}, in that order.`,
    };
  }

  const [key] = primaryKeys;

  return {
    ...PARENT_ID_SHAPE,
    description:
      `The parent ${quoted(parent)} record id (${key.name}, ${key.type}). A number or its ` +
      'string form are both accepted; the BFF forwards it to the agent as a string.',
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
  const parentProperties = {
    type: 'object' as const,
    properties: { parentId },
    required: ['parentId'],
  };
  const description =
    `Filter, sort and projection apply to ${quoted(foreign.collection.name)}, the foreign ` +
    `collection of ${quoted(plan.collection.name)}.${quoted(relation.name)}; the parent only ` +
    'resolves which records are related.';

  return {
    list: pool.add(`RelationListRequest_${relationKey}`, {
      description,
      allOf: [foreign.requests.list, parentProperties],
    }),
    count: pool.add(`RelationCountRequest_${relationKey}`, {
      description,
      allOf: [foreign.requests.count, parentProperties],
    }),
  };
}

function actionFieldSchema(field: UnfoldedAction['fields'][number]): SchemaObject {
  // A record-picker field publishes its target PK's column type, but the value it exchanges is a
  // packed id string ("42", "1|2") whatever that type is: the agent unpacks strings only.
  if (field.reference !== null) {
    return { type: 'string', description: `A packed record id for ${field.reference}.` };
  }

  // An empty enums array would emit `enum: []` and forbid every value (the same doctrine as the
  // filter leaves above), so only a non-empty options list constrains the schema.
  const enums = field.enums !== null && field.enums.length > 0 ? field.enums : null;

  let base: SchemaObject;

  if (enums === null) {
    base = toFieldSchema(field.type);
  } else if (Array.isArray(field.type)) {
    // A list field carries its options on the items: the runtime checks each member against the
    // enum, so the document must not collapse the list into a scalar string.
    base = { type: 'array', items: { type: 'string', enum: enums } };
  } else {
    base = { type: 'string', enum: enums };
  }

  return field.isRequired
    ? { ...base, description: 'The agent declares this field required on the static form.' }
    : base;
}

function actionValuesSchema(action: UnfoldedAction): SchemaObject {
  return {
    type: 'object',
    // No property is required and no additional one is forbidden on purpose: a load or change hook
    // rebuilds the form at call time, so the schema's static fields are an indication, not the
    // contract — and the read-model cannot tell a hookless action from a legacy schema that simply
    // omitted its hooks, so "static" is never certain. On execute, the values are validated
    // against that live form: a required field left empty answers 400, an out-of-enum or wrongly
    // typed value 422.
    description:
      'The submitted action fields. These are the fields the schema declares statically; a load ' +
      'or change hook can add, drop or require others at call time. On execute the values are ' +
      'validated against that live form: a required field left empty answers 400, an out-of-enum ' +
      'or wrongly typed value 422.',
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
  const listResponse = pool.reuse('ListResponse', ListResponseSchema);
  const countResponse = pool.reuse('CountResponse', CountResponseSchema);

  registerOperation(deps, {
    path: `${segment(name)}/list`,
    operationId: `listRecords_${plan.key}`,
    tag: name,
    summary: `List records of ${name}`,
    description: `Lists records of the ${quoted(name)} collection.`,
    request: plan.requests.list,
    response: listResponse,
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
      response: pool.reuse('ListResponse', ListResponseSchema),
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
      response: {},
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
      response: {},
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

    return { collection, key, requests: registerRequests(deps, { collection, key }) };
  });
  const plansByName = new Map(plans.map(plan => [plan.collection.name, plan]));

  plans.forEach(plan => {
    registerCollectionOperations(deps, plan);
    registerRelationOperations(deps, plan, plansByName, relations);
    registerActionOperations(deps, plan, actions);
  });
}
