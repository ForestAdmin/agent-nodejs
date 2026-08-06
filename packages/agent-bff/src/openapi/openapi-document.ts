import type { OpenAPIObject } from 'openapi3-ts/oas31';

import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';

import {
  ActionRequestSchema,
  CountRequestSchema,
  CountResponseSchema,
  ErrorResponseSchema,
  ListRequestSchema,
  ListResponseSchema,
  MessagelessErrorResponseSchema,
  RelationCountRequestSchema,
  RelationListRequestSchema,
} from './schemas';
import { z } from './zod-openapi';
import BODY_LIMIT from '../http/body-limit';

export const OPENAPI_VERSION = '3.1.0';
export const ROUTE_PREFIX = '/agent/v1';

const SESSION_SCHEME = 'bffSession';
const API_KEY_SCHEME = 'bffApiKey';

const SECURITY = [{ [API_KEY_SCHEME]: [] }];

const ERROR_STATUSES: Record<string, string> = {
  400: 'Malformed body, a malformed URL-encoded path segment, an invalid filter operator, a filter nested too deep, ambiguous credentials, an unsupported page, a missing or invalid timezone, an unknown submitted action field, or a rejected action form (type action_error)',
  401: 'Missing, invalid, or expired credentials',
  403: 'The action needs approval before it runs (the body carries the approving roles), the Forest identity behind the API key is not allowed, the origin is not allowed for this key, or the agent refused the collection, relation, or action',
  404: 'Unknown collection, relation, or action',
  413: `The request body exceeds the BFF limit of ${BODY_LIMIT}`,
  415: 'The request declares a character set the server cannot decode. Other content types are NOT rejected: a form-urlencoded body is parsed and validated like JSON (its values arrive as strings, so typed fields such as page.limit fail with 400), while any other non-JSON content type is read as an absent body, silently dropping filters and pagination',
  422: 'A field is unknown, not filterable, or is a nested relation path',
  429: 'The agent rate-limited the request',
  500: 'The agent payload could not be mapped to the BFF contract',
  501: 'The BFF is running without an agent configured, so the proxy is not implemented',
  502: 'The agent could not be reached',
  503: 'The agent schema is unavailable, the agent returned a 5xx, or the API key could not be resolved',
};

const UNSUPPORTED_RESULT_DESCRIPTION =
  'Either the BFF runs without an agent configured, or the action returned a result shape the ' +
  'BFF cannot normalize. The second case carries no message field.';

function errorResponses(statuses: string[], executeResults: boolean): Record<string, unknown> {
  return Object.fromEntries(
    statuses.map(status => {
      const description = ERROR_STATUSES[status];

      if (!description) throw new Error(`No OpenAPI description for error status ${status}`);

      if (status === '501' && executeResults) {
        return [
          status,
          {
            description: UNSUPPORTED_RESULT_DESCRIPTION,
            content: {
              'application/json': {
                schema: z.union([ErrorResponseSchema, MessagelessErrorResponseSchema]),
              },
            },
          },
        ];
      }

      const response: Record<string, unknown> = {
        description,
        content: { 'application/json': { schema: ErrorResponseSchema } },
      };

      if (status === '503') {
        response.headers = {
          'Retry-After': {
            description:
              'Seconds to wait before retrying. Set when the API key could not be resolved.',
            required: false,
            schema: { type: 'integer' },
          },
        };
      }

      return [status, response];
    }),
  );
}

const DATA_ERRORS = [
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
];

interface RouteDefinition {
  path: string;
  operationId: string;
  summary: string;
  request: z.ZodType;
  response: z.ZodType;
  responseDescription: string;
  params: string[];
  bodyRequired?: boolean;
  executeResults?: boolean;
}

const ROUTES: RouteDefinition[] = [
  {
    path: '/{collection}/list',
    operationId: 'listRecords',
    summary: 'List records of a collection',
    request: ListRequestSchema,
    response: ListResponseSchema,
    responseDescription: 'A page of records',
    params: ['collection'],
  },
  {
    path: '/{collection}/count',
    operationId: 'countRecords',
    summary: 'Count records of a collection',
    request: CountRequestSchema,
    response: CountResponseSchema,
    responseDescription: 'The matching record count',
    params: ['collection'],
  },
  {
    path: '/{collection}/relations/{relation}/list',
    operationId: 'listRelatedRecords',
    summary: 'List records of a to-many relation',
    request: RelationListRequestSchema,
    response: ListResponseSchema,
    responseDescription: 'A page of related records',
    params: ['collection', 'relation'],
    bodyRequired: true,
  },
  {
    path: '/{collection}/relations/{relation}/count',
    operationId: 'countRelatedRecords',
    summary: 'Count records of a to-many relation',
    request: RelationCountRequestSchema,
    response: CountResponseSchema,
    responseDescription: 'The matching related record count',
    params: ['collection', 'relation'],
    bodyRequired: true,
  },
  {
    path: '/{collection}/actions/{action}/form',
    operationId: 'getActionForm',
    summary: 'Load the form of a custom action',
    request: ActionRequestSchema,
    response: z.unknown(),
    responseDescription: 'The action form fields',
    params: ['collection', 'action'],
    bodyRequired: true,
  },
  {
    path: '/{collection}/actions/{action}/execute',
    operationId: 'executeAction',
    summary: 'Execute a custom action',
    request: ActionRequestSchema,
    response: z.unknown(),
    responseDescription: 'The normalized action result',
    params: ['collection', 'action'],
    bodyRequired: true,
    executeResults: true,
  },
];

const PARAM_DESCRIPTIONS: Record<string, string> = {
  collection: 'The exact collection name from the agent schema.',
  relation: 'The relation field name. Only to-many relations expose list and count.',
  action: 'The exact action name from the agent schema, URL-encoded. Not a slug, not an index.',
};

function buildParams(names: string[]) {
  return z.object(
    Object.fromEntries(
      names.map(name => [name, z.string().openapi({ description: PARAM_DESCRIPTIONS[name] })]),
    ),
  );
}

const TIMEZONE_HEADER_PARAM = z.object({
  'X-Forest-Timezone': z
    .string()
    .optional()
    .openapi({
      description:
        'An IANA timezone. Takes precedence over the `timezone` body field; the BFF default ' +
        'applies when neither is sent.',
    }),
});

export function generateOpenApiDocument(version: string): OpenAPIObject {
  const registry = new OpenAPIRegistry();

  registry.registerComponent('securitySchemes', SESSION_SCHEME, {
    type: 'http',
    scheme: 'bearer',
    description:
      'Mode 1: the BFF session token issued after the OAuth login. It authenticates the caller ' +
      'but the data and action routes reject it until the BFF mints an agent token from the ' +
      'OAuth principal, so no operation lists it yet. Use the API key today.',
  });
  registry.registerComponent('securitySchemes', API_KEY_SCHEME, {
    type: 'apiKey',
    in: 'header',
    name: 'X-Forest-Bff-Key',
    description: 'Mode 2: a BFF API key. Never send both this and an Authorization header.',
  });

  ROUTES.forEach(route => {
    registry.registerPath({
      method: 'post',
      path: `${ROUTE_PREFIX}${route.path}`,
      operationId: route.operationId,
      summary: route.summary,
      security: SECURITY,
      request: {
        params: buildParams(route.params),
        headers: TIMEZONE_HEADER_PARAM,
        body: {
          required: route.bodyRequired === true,
          content: { 'application/json': { schema: route.request } },
        },
      },
      responses: {
        200: {
          description: route.responseDescription,
          content: { 'application/json': { schema: route.response } },
        },
        ...errorResponses(DATA_ERRORS, route.executeResults === true),
      },
    });
  });

  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: OPENAPI_VERSION,
    info: {
      title: 'Forest Admin BFF',
      version,
      license: { name: 'GPL-3.0', url: 'https://www.gnu.org/licenses/gpl-3.0.html' },
      description:
        'Runtime routes are generic: one path per operation, with the collection, relation and ' +
        'action passed as path segments. The timezone is resolved from the `X-Forest-Timezone` ' +
        'header first, then a `timezone` body field, then the BFF default when one is ' +
        'configured. A deployment without a default rejects a request carrying neither with ' +
        '400 missing_timezone, so send one of the two to be safe. Sending a content type other ' +
        'than application/json is not an error: a form-urlencoded body is parsed like JSON, ' +
        'while any other content type is read as absent, which silently drops any filter, ' +
        'sort, or page.',
    },
    servers: [{ url: '/' }],
  });
}

export function serializeOpenApi(document: OpenAPIObject): string {
  return JSON.stringify(document, null, 2);
}
