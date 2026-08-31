import type {
  DegradedReason,
  FilterableField,
  UnfoldedCollection,
  Unfolding,
} from '../../src/openapi/unfolding';

import { allOperators } from '@forestadmin/datasource-toolkit';

import unfoldingFixture from './fixtures';
import { ROUTE_PREFIX, generateOpenApiDocument } from '../../src/openapi/openapi-document';

function unfoldedDocument(unfolding: Unfolding) {
  return generateOpenApiDocument('9.9.9', { unfolding, hasAiQueryRoute: true });
}

const document = unfoldedDocument(unfoldingFixture());
const NON_UNFOLDED_PATHS = [`${ROUTE_PREFIX}/context`, `${ROUTE_PREFIX}/ai/query`];

const paths = Object.fromEntries(
  Object.entries(document.paths ?? {}).filter(([path]) => !NON_UNFOLDED_PATHS.includes(path)),
) as Record<string, { post: Record<string, unknown> }>;
const schemas = document.components?.schemas as Record<string, Record<string, unknown>>;

function operation(path: string): Record<string, unknown> {
  return paths[`${ROUTE_PREFIX}/${path}`]?.post;
}

function requestSchemaName(path: string): string {
  const { content } = operation(path).requestBody as {
    content: Record<string, { schema: { $ref: string } }>;
  };

  return content['application/json'].schema.$ref.replace('#/components/schemas/', '');
}

function requestSchema(path: string): Record<string, never> {
  return schemas[requestSchemaName(path)] as Record<string, never>;
}

function dereference(ref: string): Record<string, unknown> {
  return schemas[ref.replace('#/components/schemas/', '')];
}

// The leaf alternatives of a filter tree are its `$ref` ones; the branch alternative is inlined.
function leavesOf(treeName: string): { fields: string[]; operators: string[] }[] {
  const { anyOf } = schemas[treeName] as unknown as { anyOf: { $ref?: string }[] };

  return anyOf
    .filter(alternative => alternative.$ref !== undefined)
    .map(alternative => {
      const { properties } = dereference(alternative.$ref as string) as unknown as {
        properties: { field: { enum?: string[] }; operator: { enum: string[] } };
      };

      return { fields: properties.field.enum ?? [], operators: properties.operator.enum };
    });
}

function filterableFieldsOf(treeName: string): string[] {
  return leavesOf(treeName).flatMap(leaf => leaf.fields);
}

function branchOf(treeName: string): Record<string, never> {
  const { anyOf } = schemas[treeName] as unknown as { anyOf: Record<string, never>[] };

  return anyOf[anyOf.length - 1];
}

function collectionOf(
  name: string,
  filterable: FilterableField[],
  degraded: DegradedReason | null = null,
): UnfoldedCollection {
  return {
    name,
    fields: { projectable: filterable.map(field => field.name), filterable, degraded },
    primaryKeys: [{ name: 'id', type: 'Number' }],
    relations: [],
    actions: [],
  };
}

// A relation request composes the foreign collection request, so its filter sits one hop further.
function relationFilterOf(path: string): string {
  const { allOf } = requestSchema(path) as unknown as { allOf: [{ $ref: string }, unknown] };
  const { properties } = dereference(allOf[0].$ref) as unknown as {
    properties: { filter: { $ref: string } };
  };

  return properties.filter.$ref.replace('#/components/schemas/', '');
}

describe('the unfolded document', () => {
  it('should emit one path per collection, to-many relation and action', () => {
    expect(Object.keys(paths).sort()).toEqual([
      `${ROUTE_PREFIX}/My%20Coll/actions/Mark%20as%20paid%2Fdone/execute`,
      `${ROUTE_PREFIX}/My%20Coll/actions/Mark%20as%20paid%2Fdone/form`,
      `${ROUTE_PREFIX}/My%20Coll/actions/Mark-as-paid%2Fdone/execute`,
      `${ROUTE_PREFIX}/My%20Coll/actions/Mark-as-paid%2Fdone/form`,
      `${ROUTE_PREFIX}/My%20Coll/count`,
      `${ROUTE_PREFIX}/My%20Coll/list`,
      `${ROUTE_PREFIX}/My%20Coll/relations/orders/count`,
      `${ROUTE_PREFIX}/My%20Coll/relations/orders/list`,
      `${ROUTE_PREFIX}/orders/count`,
      `${ROUTE_PREFIX}/orders/list`,
      `${ROUTE_PREFIX}/orders/relations/buyers/count`,
      `${ROUTE_PREFIX}/orders/relations/buyers/list`,
      `${ROUTE_PREFIX}/users.address/count`,
      `${ROUTE_PREFIX}/users.address/list`,
      `${ROUTE_PREFIX}/users.address/relations/orders/count`,
      `${ROUTE_PREFIX}/users.address/relations/orders/list`,
    ]);
  });

  it('should keep every path under the /agent/v1 prefix', () => {
    expect(Object.keys(paths).every(path => path.startsWith(`${ROUTE_PREFIX}/`))).toBe(true);
  });

  it('should give a collection absent from the read-model no path at all', () => {
    expect(Object.keys(paths).some(path => path.includes('secrets'))).toBe(false);
  });

  it('should carry the exact action name in the path, URL-encoded, slash included', () => {
    expect(
      paths[`${ROUTE_PREFIX}/My%20Coll/actions/Mark%20as%20paid%2Fdone/execute`],
    ).toBeDefined();
  });

  it('should sanitize the operationId, which redocly rejects with a space or a slash', () => {
    const operationIds = Object.values(paths).map(path => path.post.operationId as string);

    expect(operationIds).toContain('executeAction_My_Coll_Mark_as_paid_done');
    operationIds.forEach(operationId => expect(operationId).toMatch(/^[A-Za-z0-9_]+$/));
  });

  it('should suffix the second of two action names that collapse when sanitized', () => {
    expect(operation('My%20Coll/actions/Mark-as-paid%2Fdone/execute').operationId).toBe(
      'executeAction_My_Coll_Mark_as_paid_done_2',
    );
  });

  it('should name the exact action in prose, since the operationId cannot carry it', () => {
    expect(operation('My%20Coll/actions/Mark%20as%20paid%2Fdone/form').description).toContain(
      'exactly "Mark as paid/done"',
    );
    expect(operation('My%20Coll/actions/Mark%20as%20paid%2Fdone/form').summary).toContain(
      'Mark as paid/done',
    );
  });

  it('should enumerate the projectable fields of the collection', () => {
    expect(schemas.Fields_My_Coll).toEqual(
      expect.objectContaining({ type: 'string', enum: ['id', 'email', 'tags', 'author'] }),
    );
  });

  it('should leave a ManyToOne out of every filter leaf, which the runtime rejects', () => {
    expect(filterableFieldsOf('Filter_My_Coll')).toEqual(['id', 'tags', 'email']);
  });

  it('should pair each field with the operators its capabilities report', () => {
    expect(leavesOf('Filter_My_Coll')).toEqual([
      { fields: ['id', 'tags'], operators: ['Equal', 'NotEqual', 'In'] },
      { fields: ['email'], operators: ['Equal', 'NotEqual', 'In', 'Contains'] },
    ]);
  });

  it('should group two fields of different types that share one operator set', () => {
    const [first] = leavesOf('Filter_My_Coll');

    expect(first.fields).toEqual(['id', 'tags']);
  });

  it('should order the operators canonically rather than alphabetically', () => {
    const [, second] = leavesOf('Filter_My_Coll');

    expect(second.operators.indexOf('In')).toBeLessThan(second.operators.indexOf('Contains'));
  });

  it('should no longer emit a filterable-field enum, now that each leaf carries its own', () => {
    expect(Object.keys(schemas).filter(name => name.startsWith('FilterableFields'))).toEqual([]);
  });

  it('should point the filter, the projection and the sort at that collection own fields', () => {
    const request = requestSchema('My%20Coll/list') as unknown as {
      properties: Record<string, { $ref?: string; items?: { $ref: string } }>;
    };

    expect(request.properties.filter.$ref).toBe('#/components/schemas/Filter_My_Coll');
    expect(request.properties.projection.items?.$ref).toBe('#/components/schemas/Fields_My_Coll');
    expect(request.properties.sort.items?.$ref).toBe('#/components/schemas/SortClause_My_Coll');
  });

  it('should publish search and searchExtended on list and count, which the runtime accepts', () => {
    const list = requestSchema('My%20Coll/list') as unknown as {
      properties: Record<string, { $ref?: string }>;
    };
    const count = requestSchema('My%20Coll/count') as unknown as {
      properties: Record<string, { $ref?: string }>;
    };

    expect(list.properties.search.$ref).toBe('#/components/schemas/Search');
    expect(list.properties.searchExtended.$ref).toBe('#/components/schemas/SearchExtended');
    expect(count.properties.search.$ref).toBe('#/components/schemas/Search');
    expect(count.properties.searchExtended.$ref).toBe('#/components/schemas/SearchExtended');
  });

  it('should make every leaf and the branch mutually exclusive, which the runtime enforces', () => {
    const branch = branchOf('Filter_My_Coll') as unknown as { not: { required: string[] } };

    ['FilterLeaf_My_Coll-1', 'FilterLeaf_My_Coll-2'].forEach(name => {
      const leaf = schemas[name] as unknown as { not: { required: string[] } };

      expect(leaf.not.required).toEqual(['conditions']);
    });
    expect(branch.not.required).toEqual(['field']);
  });

  it('should exclude only the type the runtime reads as the other shape', () => {
    // `isBranch` needs an ARRAY `conditions` and `isLeaf` a STRING `field`, so a leaf carrying
    // `conditions: "x"` is a plain leaf the runtime accepts and the document must not refuse.
    const leaf = schemas['FilterLeaf_My_Coll-1'] as unknown as {
      not: { properties: { conditions: { type: string } } };
    };
    const branch = branchOf('Filter_My_Coll') as unknown as {
      not: { properties: { field: { type: string } } };
    };

    expect(leaf.not.properties.conditions.type).toBe('array');
    expect(branch.not.properties.field.type).toBe('string');
  });

  it('should not forbid an unknown extra key on a filter node, which the runtime forwards', () => {
    const leaf = schemas['FilterLeaf_My_Coll-1'] as { additionalProperties?: unknown };

    expect(leaf.additionalProperties).toBeUndefined();
  });

  it.each([
    ['My%20Coll/list'],
    ['My%20Coll/count'],
    ['My%20Coll/relations/orders/list'],
    ['My%20Coll/relations/orders/count'],
  ])('should say on %s that an undeclared top-level key is rejected', path => {
    const request = requestSchema(path) as unknown as { description: string };

    expect(request.description).toContain('undeclared TOP-LEVEL key with 400 invalid_request');
  });

  it('should describe a relation request with the FOREIGN collection fields, not the parent ones', () => {
    const request = requestSchema('My%20Coll/relations/orders/list') as unknown as {
      allOf: [{ $ref: string }, Record<string, unknown>];
    };

    expect(request.allOf[0].$ref).toBe('#/components/schemas/ListRequest_orders');
  });

  it('should require parentId on a relation request and name the parent key it belongs to', () => {
    const request = requestSchema('My%20Coll/relations/orders/list') as unknown as {
      allOf: [unknown, { properties: { parentId: { description: string } }; required: string[] }];
    };

    expect(request.allOf[1].required).toEqual(['parentId']);
    expect(request.allOf[1].properties.parentId.description).toContain('(id, Number)');
  });

  it('should accept a numeric parent id as a number or its string form, like the runtime', () => {
    const request = requestSchema('My%20Coll/relations/orders/list') as unknown as {
      allOf: [unknown, { properties: { parentId: { anyOf: unknown[] } } }];
    };

    expect(request.allOf[1].properties.parentId.anyOf).toEqual([
      { type: 'string', pattern: '\\S' },
      { type: 'number' },
    ]);
  });

  it('should document a composite parent key as its packed string form', () => {
    const request = requestSchema('orders/relations/buyers/list') as unknown as {
      allOf: [unknown, { properties: { parentId: { type: string; description: string } } }];
    };

    expect(request.allOf[1].properties.parentId.type).toBe('string');
    expect(request.allOf[1].properties.parentId.description).toContain(
      'shop, number joined by "|"',
    );
  });

  it('should fall back to the opaque parent id when the parent exposes no key metadata', () => {
    const request = requestSchema('users.address/relations/orders/list') as unknown as {
      allOf: [unknown, { properties: { parentId: { $ref?: string } } }];
    };

    expect(request.allOf[1].properties.parentId.$ref).toBe('#/components/schemas/ParentId');
  });

  it('should keep the paths of a collection whose capabilities failed, with free-form fields', () => {
    const request = requestSchema('orders/list') as unknown as {
      description: string;
      properties: { projection: { items: { type: string } } };
    };

    expect(request.properties.projection.items).toEqual({ type: 'string' });
    expect(request.description).toContain('NOT enumerated');
    expect(schemas.Fields_orders).toBeUndefined();
  });

  it('should keep every operator allowed on a collection whose capabilities failed', () => {
    // Narrowing the operators there would forbid calls the runtime accepts: nothing is known about
    // this collection fields, so nothing may be excluded.
    expect(leavesOf('Filter_orders')).toEqual([{ fields: [], operators: [...allOperators] }]);
  });

  it('should carry the FOREIGN collection operators on a relation path, not the parent ones', () => {
    expect(leavesOf(relationFilterOf('orders/relations/buyers/list'))).toEqual([
      { fields: ['id', 'tags'], operators: ['Equal', 'NotEqual', 'In'] },
      { fields: ['email'], operators: ['Equal', 'NotEqual', 'In', 'Contains'] },
    ]);
  });

  it('should carry the foreign free-form leaf even when the parent has enumerated operators', () => {
    // "My Coll".orders points at "orders", whose capabilities failed. The relation filter runs on the
    // foreign collection, so this path must document its permissive leaf and NOT "My Coll" variants.
    expect(filterableFieldsOf(relationFilterOf('My%20Coll/relations/orders/list'))).toEqual([]);
  });

  it('should type the action values from the static form fields, all optional', () => {
    const request = requestSchema(
      'My%20Coll/actions/Mark%20as%20paid%2Fdone/execute',
    ) as unknown as {
      properties: { values: { properties: Record<string, unknown>; required?: string[] } };
      required: string[];
    };

    expect(request.properties.values.properties).toEqual({
      reason: {
        type: 'string',
        description: 'The agent declares this field required on the static form.',
      },
      kind: { type: 'string', enum: ['refund', 'gift'] },
      files: { type: 'array', items: { type: 'string', description: 'A data URI.' } },
      payload: {},
    });
    expect(request.properties.values.required).toBeUndefined();
    expect(request.required).toEqual(['recordIds']);
  });

  it('should share one response component per error status across every unfolded path', () => {
    const errors = Object.values(paths).flatMap(path =>
      Object.entries(path.post.responses as Record<string, unknown>).filter(
        ([status]) => status !== '200',
      ),
    );

    expect(errors).toHaveLength(16 * 12);
    errors.forEach(([, response]) => {
      expect(response).toEqual({ $ref: expect.stringContaining('#/components/responses/') });
    });
  });

  it('should say in the description that the runtime routes stay generic', () => {
    expect(document.info.description).toContain('RUNTIME routes stay generic');
  });

  it('should warn that the document is not filtered by the caller permissions', () => {
    expect(document.info.description).toContain('not filtered by the permissions');
  });

  it('should reuse the timezone header parameter instead of inlining it per path', () => {
    Object.values(paths).forEach(path => {
      expect(path.post.parameters).toEqual([{ $ref: '#/components/parameters/XForestTimezone' }]);
    });
  });

  it('should not require a body on list and count, which accept an absent one', () => {
    const requiredByPath = Object.fromEntries(
      Object.entries(paths).map(([path, item]) => [
        path,
        (item.post.requestBody as { required?: boolean }).required === true,
      ]),
    );

    expect(requiredByPath[`${ROUTE_PREFIX}/My%20Coll/list`]).toBe(false);
    expect(requiredByPath[`${ROUTE_PREFIX}/My%20Coll/count`]).toBe(false);
    expect(requiredByPath[`${ROUTE_PREFIX}/My%20Coll/relations/orders/list`]).toBe(true);
    expect(requiredByPath[`${ROUTE_PREFIX}/My%20Coll/actions/Mark%20as%20paid%2Fdone/form`]).toBe(
      true,
    );
  });

  it('should build a byte-identical document from the same snapshot', () => {
    const again = unfoldedDocument(unfoldingFixture());

    expect(JSON.stringify(again)).toBe(JSON.stringify(document));
  });
});

describe('a collection whose key ends in an index-like suffix', () => {
  // `sanitizeIdentifier` turns anything outside [A-Za-z0-9_] into `_`, and `createNamer` appends
  // `_<n>` to a collapsed name, so a collection key can end in `_<digit>` on its own. A leaf namespace
  // separated by `_` would let `Invoice 1` and `Invoice` claim the same component name, and
  // `ComponentPool.add` settles a duplicate last-wins in silence.
  const collision = unfoldedDocument({
    collections: [
      collectionOf('Invoice 1', [], 'capabilities_unavailable'),
      collectionOf('Invoice', [{ name: 'total', operators: ['Equal', 'GreaterThan'] }]),
    ],
  });
  const collisionSchemas = collision.components?.schemas as Record<string, Record<string, never>>;

  it('should give each collection its own filter leaf rather than share one', () => {
    const leaves = Object.keys(collisionSchemas).filter(name => name.startsWith('FilterLeaf'));

    expect(leaves).toHaveLength(2);
    expect(new Set(leaves).size).toBe(2);
  });

  it('should not document one collection fields under the other name', () => {
    const bare = collisionSchemas.FilterLeaf_Invoice_1 as unknown as {
      description: string;
      properties: { field: { enum?: string[] } };
    };

    expect(bare.description).toContain('"Invoice 1"');
    expect(bare.properties.field.enum).toBeUndefined();
  });
});

describe('an unfolding carrying a filterable field with no operator', () => {
  it('should leave it out rather than emit an enum no value satisfies', () => {
    // An empty enum forbids every value, so the leaf would be unsatisfiable. `collectFilterableFields`
    // cannot produce one, but the generator takes hand-constructible plain data.
    const empty = unfoldedDocument({
      collections: [collectionOf('E', [{ name: 'x', operators: [] }])],
    });
    const emptySchemas = empty.components?.schemas as Record<string, Record<string, never>>;
    const leaf = emptySchemas.FilterLeaf_E as unknown as {
      properties: { field: { enum?: string[] }; operator: { enum: string[] } };
    };

    expect(Object.keys(emptySchemas).filter(name => name.startsWith('FilterLeaf'))).toEqual([
      'FilterLeaf_E',
    ]);
    expect(leaf.properties.field.enum).toBeUndefined();
    expect(leaf.properties.operator.enum).toEqual([...allOperators]);
  });
});

describe('an unfolding naming a collection it does not carry', () => {
  it('should skip that relation rather than reference a schema it never registered', () => {
    // `collectUnfolding` filters those out, but the generator takes plain data: a hand-built
    // snapshot must not be able to emit a path whose request schema does not exist.
    const orphaned = unfoldedDocument({
      collections: [
        {
          name: 'users',
          fields: {
            projectable: ['id'],
            filterable: [{ name: 'id', operators: ['Equal'] }],
            degraded: null,
          },
          primaryKeys: [{ name: 'id', type: 'Number' }],
          relations: [{ name: 'secrets', foreignCollection: 'secrets' }],
          actions: [],
        },
      ],
    });

    expect(Object.keys(orphaned.paths ?? {})).toEqual([
      '/agent/v1/context',
      '/agent/v1/ai/query',
      '/agent/v1/users/list',
      '/agent/v1/users/count',
    ]);
  });
});

describe('names that collide once sanitized', () => {
  // `_` is both what sanitizing produces and the separator between a collection and its child, so
  // deduplicating each segment on its own is not enough: `A_B` + `C` and `A` + `B_C` compose the same
  // identifier, and one action would silently get the other's request schema.
  const collection = (
    name: string,
    actionName: string,
    relationName: string,
  ): UnfoldedCollection => ({
    name,
    fields: {
      projectable: ['id'],
      filterable: [{ name: 'id', operators: ['Equal'] }],
      degraded: null,
    },
    primaryKeys: [{ name: 'id', type: 'Number' }],
    relations: [{ name: relationName, foreignCollection: name }],
    actions: [{ name: actionName, fields: [] }],
  });

  const colliding = unfoldedDocument({
    collections: [collection('A_B', 'C', 'R'), collection('A', 'B_C', 'B_R')],
  });
  const operationIds = Object.values(
    colliding.paths as Record<string, { post?: { operationId: string } }>,
  )
    .filter(item => item.post !== undefined)
    .map(item => (item.post as { operationId: string }).operationId);

  it('should keep every operationId unique, which codegen tools require', () => {
    expect(new Set(operationIds).size).toBe(operationIds.length);
  });

  it('should suffix the second composed identifier rather than reuse it', () => {
    expect(operationIds).toContain('executeAction_A_B_C');
    expect(operationIds).toContain('executeAction_A_B_C_2');
    expect(operationIds).toContain('listRelatedRecords_A_B_R');
    expect(operationIds).toContain('listRelatedRecords_A_B_R_2');
  });

  it('should give each action its own request schema, not the other one', () => {
    const collidingPaths = colliding.paths as Record<
      string,
      { post: { requestBody: { content: Record<string, { schema: { $ref: string } }> } } }
    >;
    const refs = Object.entries(collidingPaths)
      .filter(([path]) => path.includes('/actions/'))
      .map(([, item]) => item.post.requestBody.content['application/json'].schema.$ref);

    expect(new Set(refs).size).toBe(2);
  });
});

describe('an unfolded document with no action', () => {
  it('should not carry the action-result response, which nothing would reference', () => {
    const withoutActions = unfoldedDocument({
      collections: [
        {
          name: 'users',
          fields: {
            projectable: ['id'],
            filterable: [{ name: 'id', operators: ['Equal'] }],
            degraded: null,
          },
          primaryKeys: [{ name: 'id', type: 'Number' }],
          relations: [],
          actions: [],
        },
      ],
    });

    expect(Object.keys(withoutActions.components?.responses ?? {})).not.toContain(
      'UnsupportedActionResult',
    );
    expect(Object.keys(withoutActions.components?.schemas ?? {})).not.toContain(
      'MessagelessErrorResponse',
    );
  });
});

describe('the tags of an unfolded document', () => {
  const tagsOf = (path: string) => operation(path).tags;

  it('should declare one tag per collection, in the order the schema exposes them', () => {
    expect(document.tags).toEqual([
      {
        name: 'My Coll',
        description: 'Records, relations and actions of the "My Coll" collection.',
      },
      { name: 'orders', description: 'Records, relations and actions of the "orders" collection.' },
      {
        name: 'users.address',
        description: 'Records, relations and actions of the "users.address" collection.',
      },
    ]);
  });

  it('should tag records operations with their own collection', () => {
    expect([tagsOf('My%20Coll/list'), tagsOf('My%20Coll/count')]).toEqual([
      ['My Coll'],
      ['My Coll'],
    ]);
  });

  it('should tag a relation with the parent collection, not the foreign one', () => {
    expect(tagsOf('My%20Coll/relations/orders/list')).toEqual(['My Coll']);
  });

  it('should tag an action with the collection it belongs to', () => {
    expect(tagsOf('My%20Coll/actions/Mark%20as%20paid%2Fdone/execute')).toEqual(['My Coll']);
  });

  it('should leave no collection operation untagged, since one would fall outside every group', () => {
    const untagged = Object.entries(paths)
      .filter(([, item]) => ((item.post.tags as string[] | undefined) ?? []).length === 0)
      .map(([path]) => path);

    expect(untagged).toEqual([]);
  });

  it('should reference only declared tags, so a viewer groups nothing under an unknown name', () => {
    const declared = new Set((document.tags ?? []).map(tag => tag.name));
    const used = new Set(
      Object.values(paths).flatMap(item => (item.post.tags as string[] | undefined) ?? []),
    );

    expect([...used].filter(tag => !declared.has(tag))).toEqual([]);
  });
});

describe('the tags of a generic document', () => {
  it('should carry none, since one operation per shape has nothing to group', () => {
    expect(generateOpenApiDocument('9.9.9').tags).toBeUndefined();
  });
});
