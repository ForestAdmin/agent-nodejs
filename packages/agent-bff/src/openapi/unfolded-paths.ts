import type ComponentPool from './component-pool';
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
    'field on this collection.',
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

function filterSchema(
  { pool }: Deps,
  plan: Pick<CollectionPlan, 'key' | 'collection'>,
  filterable: ReferenceObject | SchemaObject,
): ReferenceObject {
  const { name } = plan.collection;
  const treeName = `Filter_${plan.key}`;
  const treeRef = { $ref: `#/components/schemas/${treeName}` };

  const leaf = pool.add(`FilterLeaf_${plan.key}`, {
    type: 'object',
    description: `A single condition on ${quoted(name)}.`,
    properties: {
      field: filterable,
      operator: { type: 'string', enum: OPERATORS },
      value: {},
    },
    required: ['field', 'operator'],
  });

  return pool.add(treeName, {
    description:
      `A filter on ${quoted(name)}: either a leaf condition or a branch nesting more ` +
      'conditions. A branch must carry its aggregator.',
    anyOf: [
      leaf,
      {
        type: 'object',
        properties: {
          aggregator: { type: 'string', enum: AGGREGATORS },
          conditions: { type: 'array', items: treeRef },
        },
        required: ['aggregator', 'conditions'],
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

  // Filterable is a strict subset of projectable: the agent reports a ManyToOne without operators,
  // so projecting or sorting on it works while filtering on it answers 400 field_not_filterable.
  const filterable = fieldsEnum(
    pool,
    `FilterableFields_${plan.key}`,
    fields.filterable,
    `A filterable field of ${quoted(name)}.`,
  );

  return {
    projectable,
    filter: filterSchema(deps, plan, filterable),
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

/**
 * `parentId` is opaque on the wire, but the read-model knows the parent's key: only a `Number`
 * column comes back as a number, every other type stays a string, and a composite key travels as its
 * `|`-joined values (`unpackPrimaryKey` mirrors the agent's `IdUtils`).
 */
function parentIdSchema(
  pool: ComponentPool,
  parent: string,
  primaryKeys: PrimaryKeyField[],
): ReferenceObject | SchemaObject {
  if (primaryKeys.length === 0) return pool.reuse('ParentId', ParentIdSchema);

  if (primaryKeys.length > 1) {
    return {
      type: 'string',
      description:
        `The composite id of the parent ${quoted(parent)} record: the values of ` +
        `${primaryKeys.map(key => key.name).join(', ')} joined by ` +
        `${quoted(PACKED_ID_SEPARATOR)}, in that order.`,
    };
  }

  const [key] = primaryKeys;
  const schema = key.type === 'Number' ? { type: 'number' as const } : { type: 'string' as const };

  return { ...schema, description: `The parent ${quoted(parent)} record id (${key.name}).` };
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
    list: pool.add(`RelationListRequest_${plan.key}_${relationKey}`, {
      description,
      allOf: [foreign.requests.list, parentProperties],
    }),
    count: pool.add(`RelationCountRequest_${plan.key}_${relationKey}`, {
      description,
      allOf: [foreign.requests.count, parentProperties],
    }),
  };
}

function actionFieldSchema(field: UnfoldedAction['fields'][number]): SchemaObject {
  const base = field.enums
    ? { type: 'string' as const, enum: field.enums }
    : toFieldSchema(field.type);

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
    // omitted its hooks, so "static" is never certain.
    description:
      'The submitted action fields. These are the fields the schema declares statically; a load ' +
      'or change hook can add, drop or require others at call time.',
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

  return pool.add(`ActionRequest_${plan.key}_${actionKey}`, {
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
): void {
  const { pool } = deps;
  const namer = createNamer();

  plan.collection.relations.forEach(relation => {
    const foreign = plansByName.get(relation.foreignCollection);
    if (!foreign) return;

    const relationKey = namer(relation.name);
    const requests = registerRelationRequests(deps, plan, relation, relationKey, foreign);
    const parent = `${quoted(plan.collection.name)}.${quoted(relation.name)}`;

    registerOperation(deps, {
      path: `${segment(plan.collection.name)}/relations/${segment(relation.name)}/list`,
      operationId: `listRelatedRecords_${plan.key}_${relationKey}`,
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
      operationId: `countRelatedRecords_${plan.key}_${relationKey}`,
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

function registerActionOperations(deps: Deps, plan: CollectionPlan): void {
  const namer = createNamer();

  plan.collection.actions.forEach(action => {
    const actionKey = namer(action.name);
    const request = registerActionRequest(deps, plan, action, actionKey);
    // The path segment is the exact schema action name, URL-encoded — that is what the middleware
    // decodes and looks up. The operationId is sanitized, so the exact name lives in prose.
    const identity = `The action name is exactly ${quoted(action.name)}.`;
    const base = `${segment(plan.collection.name)}/actions/${segment(action.name)}`;

    registerOperation(deps, {
      path: `${base}/form`,
      operationId: `getActionForm_${plan.key}_${actionKey}`,
      summary: `Load the form of ${action.name} on ${plan.collection.name}`,
      description: `Loads the form of the custom action. ${identity} An unknown submitted field is skipped here, not rejected.`,
      request,
      response: {},
      responseDescription: 'The action form fields',
      bodyRequired: true,
    });

    registerOperation(deps, {
      path: `${base}/execute`,
      operationId: `executeAction_${plan.key}_${actionKey}`,
      summary: `Execute ${action.name} on ${plan.collection.name}`,
      description: `Executes the custom action. ${identity} A submitted field the loaded form does not carry is rejected with 400.`,
      request,
      response: {},
      responseDescription: 'The normalized action result',
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
  const namer = createNamer();
  const plans = unfolding.collections.map(collection => {
    const key = namer(collection.name);

    return { collection, key, requests: registerRequests(deps, { collection, key }) };
  });
  const plansByName = new Map(plans.map(plan => [plan.collection.name, plan]));

  plans.forEach(plan => {
    registerCollectionOperations(deps, plan);
    registerRelationOperations(deps, plan, plansByName);
    registerActionOperations(deps, plan);
  });
}
