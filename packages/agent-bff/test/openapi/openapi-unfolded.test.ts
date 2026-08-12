import unfoldingFixture from './fixtures';
import { ROUTE_PREFIX, generateOpenApiDocument } from '../../src/openapi/openapi-document';

const document = generateOpenApiDocument('9.9.9', unfoldingFixture());
const paths = document.paths as Record<string, { post: Record<string, unknown> }>;
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

  it('should leave a ManyToOne out of the filterable fields, which the runtime rejects', () => {
    expect(schemas.FilterableFields_My_Coll).toEqual(
      expect.objectContaining({ type: 'string', enum: ['id', 'email', 'tags'] }),
    );
  });

  it('should point the filter, the projection and the sort at that collection own fields', () => {
    const request = requestSchema('My%20Coll/list') as unknown as {
      properties: Record<string, { $ref?: string; items?: { $ref: string } }>;
    };

    expect(request.properties.filter.$ref).toBe('#/components/schemas/Filter_My_Coll');
    expect(request.properties.projection.items?.$ref).toBe('#/components/schemas/Fields_My_Coll');
    expect(request.properties.sort.items?.$ref).toBe('#/components/schemas/SortClause_My_Coll');
  });

  it('should make the leaf and the branch mutually exclusive, which the runtime enforces', () => {
    const leaf = schemas.FilterLeaf_My_Coll as unknown as { not: { required: string[] } };
    const tree = schemas.Filter_My_Coll as unknown as {
      anyOf: [unknown, { not: { required: string[] } }];
    };

    expect(leaf.not.required).toEqual(['conditions']);
    expect(tree.anyOf[1].not.required).toEqual(['field']);
  });

  it('should exclude only the type the runtime reads as the other shape', () => {
    // `isBranch` needs an ARRAY `conditions` and `isLeaf` a STRING `field`, so a leaf carrying
    // `conditions: "x"` is a plain leaf the runtime accepts and the document must not refuse.
    const leaf = schemas.FilterLeaf_My_Coll as unknown as {
      not: { properties: { conditions: { type: string } } };
    };
    const tree = schemas.Filter_My_Coll as unknown as {
      anyOf: [unknown, { not: { properties: { field: { type: string } } } }];
    };

    expect(leaf.not.properties.conditions.type).toBe('array');
    expect(tree.anyOf[1].not.properties.field.type).toBe('string');
  });

  it('should not forbid an unknown extra key on a filter node, which the runtime strips', () => {
    const leaf = schemas.FilterLeaf_My_Coll as { additionalProperties?: unknown };

    expect(leaf.additionalProperties).toBeUndefined();
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
    const again = generateOpenApiDocument('9.9.9', unfoldingFixture());

    expect(JSON.stringify(again)).toBe(JSON.stringify(document));
  });
});

describe('names that collide once sanitized', () => {
  // `_` is both what sanitizing produces and the separator between a collection and its child, so
  // deduplicating each segment on its own is not enough: `A_B` + `C` and `A` + `B_C` compose the same
  // identifier, and one action would silently get the other's request schema.
  const collection = (name: string, actionName: string, relationName: string) => ({
    name,
    fields: { projectable: ['id'], filterable: ['id'], degraded: null },
    primaryKeys: [{ name: 'id', type: 'Number' }],
    relations: [{ name: relationName, foreignCollection: name }],
    actions: [{ name: actionName, fields: [] }],
  });

  const colliding = generateOpenApiDocument('9.9.9', {
    collections: [collection('A_B', 'C', 'R'), collection('A', 'B_C', 'B_R')],
  });
  const operationIds = Object.values(
    colliding.paths as Record<string, { post: { operationId: string } }>,
  ).map(item => item.post.operationId);

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
    const withoutActions = generateOpenApiDocument('9.9.9', {
      collections: [
        {
          name: 'users',
          fields: { projectable: ['id'], filterable: ['id'], degraded: null },
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
