import { allOperators } from '@forestadmin/datasource-toolkit';

import {
  OPENAPI_VERSION,
  ROUTE_PREFIX,
  generateOpenApiDocument,
  serializeOpenApi,
} from '../../src/openapi/openapi-document';

const document = generateOpenApiDocument('9.9.9');
const schemas = document.components?.schemas as Record<string, Record<string, unknown>>;

type ResolvedResponse = {
  description: string;
  headers?: Record<string, unknown>;
  content?: Record<string, { schema: Record<string, unknown> }>;
};

const responseComponents = (document.components?.responses ?? {}) as unknown as Record<
  string,
  ResolvedResponse
>;

function responsesOf(path: string): Record<string, ResolvedResponse> {
  const { responses } = (document.paths?.[path] as { post: { responses: Record<string, unknown> } })
    .post;

  return Object.fromEntries(
    Object.entries(responses).map(([status, response]) => {
      const ref = (response as { $ref?: string }).$ref;
      const resolved = ref
        ? responseComponents[ref.replace('#/components/responses/', '')]
        : (response as ResolvedResponse);

      return [status, resolved];
    }),
  );
}

function listResponses(): Record<string, ResolvedResponse> {
  return responsesOf(`${ROUTE_PREFIX}/{collection}/list`);
}

function leafOperators(): string[] {
  const leaf = schemas.ConditionTreeLeaf as {
    properties: { operator: { enum: string[] } };
  };

  return leaf.properties.operator.enum;
}

describe('generateOpenApiDocument', () => {
  it('should emit OpenAPI 3.1.0 with the package version', () => {
    expect(document.openapi).toBe(OPENAPI_VERSION);
    expect(document.info.version).toBe('9.9.9');
  });

  it('should serve every path under the /agent/v1 prefix', () => {
    const paths = Object.keys(document.paths ?? {});

    expect(paths).toHaveLength(6);
    expect(paths.every(path => path.startsWith(`${ROUTE_PREFIX}/`))).toBe(true);
  });

  it('should expose the six generic runtime routes', () => {
    expect(Object.keys(document.paths ?? {}).sort()).toEqual([
      `${ROUTE_PREFIX}/{collection}/actions/{action}/execute`,
      `${ROUTE_PREFIX}/{collection}/actions/{action}/form`,
      `${ROUTE_PREFIX}/{collection}/count`,
      `${ROUTE_PREFIX}/{collection}/list`,
      `${ROUTE_PREFIX}/{collection}/relations/{relation}/count`,
      `${ROUTE_PREFIX}/{collection}/relations/{relation}/list`,
    ]);
  });

  it('should declare every filter operator in PascalCase', () => {
    expect(leafOperators()).toEqual([...allOperators]);
  });

  it('should declare no snake_case operator, since a request in that casing is rejected', () => {
    expect(leafOperators().filter(operator => operator.includes('_'))).toEqual([]);
  });

  it('should require both field and operator on a filter leaf', () => {
    expect(schemas.ConditionTreeLeaf.required).toEqual(['field', 'operator']);
  });

  it('should make sort direction optional, since omitting it sorts ascending', () => {
    expect(schemas.SortClause.required).toEqual(['field']);
  });

  it('should accept a parent id as a non-blank string or a number', () => {
    expect(schemas.ParentId.anyOf).toEqual([
      { type: 'string', pattern: '\\S' },
      { type: 'number' },
    ]);
  });

  it('should require the aggregator on a branch, since the agent 400s without it', () => {
    const tree = schemas.ConditionTree as { anyOf: Record<string, unknown>[] };
    const branch = tree.anyOf[1] as { required: string[] };

    expect(branch.required.sort()).toEqual(['aggregator', 'conditions']);
  });

  it('should describe the filter as a tree that nests itself', () => {
    const tree = schemas.ConditionTree as { anyOf: Record<string, unknown>[] };
    const branch = tree.anyOf[1] as {
      properties: { conditions: { items: { $ref: string } } };
    };

    expect(tree.anyOf[0]).toEqual({ $ref: '#/components/schemas/ConditionTreeLeaf' });
    expect(branch.properties.conditions.items.$ref).toBe('#/components/schemas/ConditionTree');
  });

  it('should pair a count with available and a null with deactivated, never the reverse', () => {
    const count = schemas.CountResponse as {
      anyOf: { properties: { count: unknown; countStatus: { enum: string[] } } }[];
    };

    expect(count.anyOf).toHaveLength(2);
    expect(count.anyOf[0].properties).toEqual({
      count: { type: 'number' },
      countStatus: { type: 'string', enum: ['available'] },
    });
    expect(count.anyOf[1].properties).toEqual({
      count: { type: 'null' },
      countStatus: { type: 'string', enum: ['deactivated'] },
    });
  });

  it('should pin the list count status to not_requested, since a list never carries a total', () => {
    const list = schemas.ListResponse as {
      properties: { meta: { properties: { countStatus: { enum: string[] } } } };
    };

    expect(list.properties.meta.properties.countStatus.enum).toEqual(['not_requested']);
  });

  it('should still define the session scheme, since OAuth authenticates the doc route itself', () => {
    expect(document.components?.securitySchemes).toEqual({
      bffSession: expect.objectContaining({ type: 'http', scheme: 'bearer' }),
      bffApiKey: expect.objectContaining({
        type: 'apiKey',
        in: 'header',
        name: 'X-Forest-Bff-Key',
      }),
    });
  });

  it('should secure every operation with the API key only, the one mode the routes accept', () => {
    const operations = Object.values(document.paths ?? {}).map(
      path => (path as { post: { security: unknown } }).post,
    );

    expect(operations).toHaveLength(6);
    operations.forEach(operation => {
      expect(operation.security).toEqual([{ bffApiKey: [] }]);
    });
  });

  it('should say in the session scheme why no operation accepts it yet', () => {
    const session = (
      document.components?.securitySchemes as Record<string, { description: string }>
    ).bffSession;

    expect(session.description).toContain('reject it until');
  });

  it('should require a body where parentId or recordIds is mandatory', () => {
    const requiredByPath = Object.fromEntries(
      Object.entries(document.paths ?? {}).map(([path, item]) => [
        path,
        (item as { post: { requestBody: { required?: boolean } } }).post.requestBody.required ===
          true,
      ]),
    );

    expect(requiredByPath).toEqual({
      [`${ROUTE_PREFIX}/{collection}/list`]: false,
      [`${ROUTE_PREFIX}/{collection}/count`]: false,
      [`${ROUTE_PREFIX}/{collection}/relations/{relation}/list`]: true,
      [`${ROUTE_PREFIX}/{collection}/relations/{relation}/count`]: true,
      [`${ROUTE_PREFIX}/{collection}/actions/{action}/form`]: true,
      [`${ROUTE_PREFIX}/{collection}/actions/{action}/execute`]: true,
    });
  });

  it('should document every error status a data route can return', () => {
    const list = document.paths?.[`${ROUTE_PREFIX}/{collection}/list`] as {
      post: { responses: Record<string, unknown> };
    };

    expect(Object.keys(list.post.responses).sort()).toEqual([
      '200',
      '400',
      '401',
      '403',
      '404',
      '413',
      '415',
      '422',
      '429',
      '500',
      '501',
      '502',
      '503',
    ]);
  });

  it('should document 502, which any agent transport failure returns', () => {
    Object.values(document.paths ?? {}).forEach(path => {
      expect(
        Object.keys((path as { post: { responses: Record<string, unknown> } }).post.responses),
      ).toContain('502');
    });
  });

  it('should document 413, since the BFF caps the body at 16kb', () => {
    Object.values(document.paths ?? {}).forEach(path => {
      expect(
        Object.keys((path as { post: { responses: Record<string, unknown> } }).post.responses),
      ).toContain('413');
    });
  });

  it('should declare 501 everywhere, since the agent stub returns it on every route', () => {
    Object.values(document.paths ?? {}).forEach(path => {
      expect(
        Object.keys((path as { post: { responses: Record<string, unknown> } }).post.responses),
      ).toContain('501');
    });
  });

  it('should allow a messageless 501 body on execute, which the result mapper returns', () => {
    const execute = responsesOf(`${ROUTE_PREFIX}/{collection}/actions/{action}/execute`);

    expect(execute['501'].content?.['application/json'].schema.anyOf).toEqual([
      { $ref: '#/components/schemas/ErrorResponse' },
      { $ref: '#/components/schemas/MessagelessErrorResponse' },
    ]);

    const messageless = schemas.MessagelessErrorResponse as {
      properties: { error: { required: string[] } };
    };

    expect(messageless.properties.error.required).toEqual(['type', 'status']);
  });

  it('should keep a plain error body for the 501 the agent stub returns on other routes', () => {
    expect(listResponses()['501'].content?.['application/json'].schema.$ref).toBe(
      '#/components/schemas/ErrorResponse',
    );
  });

  it('should share one response component per error status instead of inlining it per path', () => {
    const errors = Object.values(document.paths ?? {}).flatMap(path =>
      Object.entries(
        (path as { post: { responses: Record<string, unknown> } }).post.responses,
      ).filter(([status]) => status !== '200'),
    );

    expect(errors).toHaveLength(72);
    errors.forEach(([, response]) => {
      expect(response).toEqual({ $ref: expect.stringContaining('#/components/responses/') });
    });
    expect(Object.keys(responseComponents).sort()).toEqual([
      'Error400',
      'Error401',
      'Error403',
      'Error404',
      'Error413',
      'Error415',
      'Error422',
      'Error429',
      'Error500',
      'Error501',
      'Error502',
      'Error503',
      'UnsupportedActionResult',
    ]);
  });

  it('should declare the timezone header as a parameter, not only in prose', () => {
    const header = (
      document.components?.parameters as Record<
        string,
        { name: string; in: string; required?: boolean }
      >
    ).XForestTimezone;

    expect(header).toEqual(
      expect.objectContaining({ name: 'X-Forest-Timezone', in: 'header', required: false }),
    );
  });

  it('should share the timezone header as one parameter component instead of per path', () => {
    const parameters = Object.values(document.paths ?? {}).flatMap(
      path => (path as { post: { parameters: unknown[] } }).post.parameters,
    );

    expect(parameters).toContainEqual({ $ref: '#/components/parameters/XForestTimezone' });
  });

  it('should describe an invalid filter operator under 400, the status it actually returns', () => {
    const list = listResponses();

    expect(list['400'].description).toContain('invalid filter operator');
    expect(list['422'].description).not.toContain('operator');
  });

  it('should distinguish a form body, which is parsed, from other non-JSON bodies, which drop', () => {
    const list = listResponses();

    expect(list['415'].description).toContain('NOT rejected');
    expect(list['415'].description).toContain('form-urlencoded');
    expect(document.info.description).toContain('form-urlencoded');
    expect(document.info.description).toContain('silently');
  });

  it('should name the 403s the BFF itself emits, not only the agent passthrough', () => {
    const list = listResponses();

    expect(list['403'].description).toContain('needs approval');
    expect(list['403'].description).toContain('Forest identity');
  });

  it('should warn that a missing timezone is a 400 when no default is configured', () => {
    expect(listResponses()['400'].description).toContain('missing or invalid timezone');
    expect(document.info.description).toContain('missing_timezone');
  });

  it('should accept a timezone on an action body, which the middleware reads there too', () => {
    expect(Object.keys(schemas.ActionRequest.properties as object)).toContain('timezone');
  });

  it('should declare Retry-After on 503, the only status that sets it', () => {
    const list = listResponses();

    expect(Object.keys(list['503'].headers ?? {})).toEqual(['Retry-After']);
    expect(list['429'].headers).toBeUndefined();
  });

  it('should not promise a Retry-After on 429, where no code path sets one', () => {
    expect(listResponses()['429'].description).not.toContain('Retry-After');
  });

  it('should give every response a description, which the OpenAPI struct rule requires', () => {
    const responses = Object.keys(document.paths ?? {}).flatMap(path =>
      Object.values(responsesOf(path)),
    );

    expect(responses.length).toBeGreaterThan(0);
    responses.forEach(response => expect(typeof response.description).toBe('string'));
  });

  it('should require recordIds on an action, since the middleware rejects a missing array', () => {
    expect(schemas.ActionRequest.required).toEqual(['recordIds']);
  });

  it('should type a primary key value as a string or a number, matching the record mapper', () => {
    const meta = schemas.ForestRecordMeta as {
      properties: { primaryKey: { additionalProperties: { anyOf: unknown[] } } };
    };

    expect(meta.properties.primaryKey.additionalProperties.anyOf).toEqual([
      { type: 'string' },
      { type: 'number' },
    ]);
  });

  it('should carry the package license, which the OpenAPI recommended ruleset requires', () => {
    expect(document.info.license).toEqual({
      name: 'GPL-3.0',
      url: 'https://www.gnu.org/licenses/gpl-3.0.html',
    });
  });
});

describe('the documented search inputs', () => {
  function propertiesOf(name: string): Record<string, { $ref?: string }> {
    return (schemas[name] as { properties: Record<string, { $ref?: string }> }).properties;
  }

  function refsOf(name: string): string[] {
    return (schemas[name] as { allOf: Array<{ $ref?: string }> }).allOf
      .map(entry => entry.$ref)
      .filter(Boolean) as string[];
  }

  it.each([['ListRequest'], ['CountRequest']])('should expose search on %s', name => {
    expect(propertiesOf(name).search).toEqual({ $ref: '#/components/schemas/Search' });
    expect(propertiesOf(name).searchExtended).toEqual({
      $ref: '#/components/schemas/SearchExtended',
    });
  });

  it.each([
    ['RelationListRequest', 'ListRequest'],
    ['RelationCountRequest', 'CountRequest'],
  ])('should let %s inherit the search inputs from %s', (relation, base) => {
    expect(refsOf(relation)).toContain(`#/components/schemas/${base}`);
  });

  it('should say a blank search is treated as absent rather than rejected', () => {
    expect(schemas.Search.description).toContain('treated as absent');
  });

  it('should say a non-searchable collection is answered by the agent, not the BFF', () => {
    expect(schemas.Search.description).toContain('Collection is not searchable');
  });

  it('should say searchExtended alone changes nothing', () => {
    expect(schemas.SearchExtended.description).toContain('without `search` it is ignored');
  });

  it('should warn that searchExtended reads relation fields the response cannot show', () => {
    expect(schemas.SearchExtended.description).toContain('relation_field_not_supported');
  });
});

describe('serializeOpenApi', () => {
  it('should produce indented JSON that parses back to the same document', () => {
    const serialized = serializeOpenApi(document);

    expect(serialized).toContain('\n  ');
    expect(JSON.parse(serialized)).toEqual(JSON.parse(JSON.stringify(document)));
  });
});
