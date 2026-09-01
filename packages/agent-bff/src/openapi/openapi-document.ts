import type { Unfolding } from './unfolding';
import type { OpenAPIObject, ReferenceObject, SchemaObject } from 'openapi3-ts/oas31';

import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';

import ComponentPool from './component-pool';
import {
  ActionRequestSchema,
  AiQueryRequestSchema,
  ContextResponseSchema,
  CountRequestSchema,
  CountResponseSchema,
  ErrorResponseSchema,
  ListRequestSchema,
  ListResponseSchema,
  MessagelessErrorResponseSchema,
  RelationCountRequestSchema,
  RelationListRequestSchema,
} from './schemas';
import registerUnfoldedPaths from './unfolded-paths';
import { z } from './zod-openapi';
import BODY_LIMIT, { AI_BODY_LIMIT } from '../http/body-limit';

export const OPENAPI_VERSION = '3.1.0';
export const ROUTE_PREFIX = '/agent/v1';

const SESSION_SCHEME = 'bffSession';
const API_KEY_SCHEME = 'bffApiKey';

const SECURITY = [{ [SESSION_SCHEME]: [] }, { [API_KEY_SCHEME]: [] }];

const ERROR_STATUSES: Record<string, string> = {
  400: 'Malformed body, a malformed URL-encoded path segment, an invalid filter operator, a filter nested too deep, ambiguous credentials, an unsupported page, a missing or invalid timezone, an unknown submitted action field, or a rejected action form (type action_error)',
  401: 'Missing, invalid, or expired credentials',
  403: 'The action needs approval before it runs (the body carries the approving roles), the Forest identity behind the API key is not allowed, the origin is not allowed for this key, or the agent refused the collection, relation, or action',
  404: 'Unknown collection, relation, or action',
  413: `The request body exceeds the BFF limit of ${BODY_LIMIT}`,
  415: 'The request declares a character set the server cannot decode. Other content types are NOT rejected: a form-urlencoded body is parsed and validated like JSON (its values arrive as strings, so typed fields such as page.limit fail with 400), while any other non-JSON content type is read as an absent body, silently dropping filters and pagination',
  422: 'A field is unknown, not filterable, or is a nested relation path',
  429: 'The agent rate-limited the request',
  500: 'The agent payload could not be mapped to the BFF contract, or the BFF hit an unexpected error',
  501: 'The BFF is running without an agent configured, so the proxy is not implemented',
  502: 'The agent could not be reached',
  503: 'The agent schema is unavailable, the agent returned a 5xx, or the API key could not be resolved',
};

const UNSUPPORTED_RESULT_DESCRIPTION =
  'Either the BFF runs without an agent configured, or the action returned a result shape the ' +
  'BFF cannot normalize. The second case carries no message field.';

const ERROR_RESPONSE_REF = '#/components/schemas/ErrorResponse';
const MESSAGELESS_ERROR_RESPONSE_REF = '#/components/schemas/MessagelessErrorResponse';

const UNSUPPORTED_ACTION_RESULT_COMPONENT = 'UnsupportedActionResult';

const RETRY_AFTER_HEADER = {
  'Retry-After': {
    description: 'Seconds to wait before retrying. Set when the API key could not be resolved.',
    required: false,
    schema: { type: 'integer' as const },
  },
};

type ResponseRef = { $ref: string };

interface ErrorResponseRefs {
  byStatus: Record<string, ResponseRef>;
  unsupportedActionResult: ResponseRef;
}

interface ErrorComponent {
  description: string;
  schema: SchemaObject | ReferenceObject;
  headers?: typeof RETRY_AFTER_HEADER;
}

function registerErrorComponent(
  registry: OpenAPIRegistry,
  name: string,
  { description, schema, headers }: ErrorComponent,
): ResponseRef {
  return registry.registerComponent('responses', name, {
    description,
    content: { 'application/json': { schema } },
    ...(headers ? { headers } : {}),
  }).ref;
}

// Every error body is identical across paths, and their descriptions are long: inlining them costs
// ~2.8kB per path, which the unfolded document multiplies by every collection, relation and action.
// Registering them once as components keeps a path's error block to a dozen refs.
function registerErrorResponses(
  registry: OpenAPIRegistry,
  statuses: string[],
  withActionResults: boolean,
): ErrorResponseRefs {
  registry.register('ErrorResponse', ErrorResponseSchema);

  const byStatus: Record<string, ResponseRef> = {};

  statuses.forEach(status => {
    const description = ERROR_STATUSES[status];

    if (!description) throw new Error(`No OpenAPI description for error status ${status}`);

    byStatus[status] = registerErrorComponent(registry, `Error${status}`, {
      description,
      schema: { $ref: ERROR_RESPONSE_REF },
      ...(status === '503' ? { headers: RETRY_AFTER_HEADER } : {}),
    });
  });

  // A document with no action path must not carry this response, nor the messageless body it
  // references: an unreferenced component trips redocly's unused-component rule.
  if (!withActionResults) return { byStatus, unsupportedActionResult: byStatus['501'] };

  registry.register('MessagelessErrorResponse', MessagelessErrorResponseSchema);

  const unsupportedActionResult = registerErrorComponent(
    registry,
    UNSUPPORTED_ACTION_RESULT_COMPONENT,
    {
      description: UNSUPPORTED_RESULT_DESCRIPTION,
      schema: {
        anyOf: [{ $ref: ERROR_RESPONSE_REF }, { $ref: MESSAGELESS_ERROR_RESPONSE_REF }],
      },
    },
  );

  return { byStatus, unsupportedActionResult };
}

function errorResponses(
  refs: ErrorResponseRefs,
  executeResults: boolean,
): Record<string, ResponseRef> {
  return executeResults
    ? { ...refs.byStatus, 501: refs.unsupportedActionResult }
    : { ...refs.byStatus };
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

const AI_RELAYED_OR_ENVELOPE =
  'Below 500 the BFF relays whatever JSON the Forest AI proxy answered, unchanged, so the authority ' +
  'on this body is the upstream contract and not the BFF one. When the upstream answer carried no ' +
  'JSON body, the BFF substitutes its own `{ error: { type, status, message } }` envelope at the ' +
  'same status. A consumer must accept either shape.';

const AI_DUAL_SHAPED_ERRORS: Record<string, string> = {
  400: `The BFF could not parse the body as JSON, or the Forest AI proxy rejected the query. ${AI_RELAYED_OR_ENVELOPE}`,
  401: `The BFF session is missing, invalid or expired, or the Forest server refused the access token this route forwards. ${AI_RELAYED_OR_ENVELOPE}`,
  403: `The request presented an API key instead of a session (type oauth_required), or the Forest server refused the query. ${AI_RELAYED_OR_ENVELOPE}`,
  413: `The request body exceeds the AI query limit of ${AI_BODY_LIMIT}, or the Forest AI proxy refused it as too large. ${AI_RELAYED_OR_ENVELOPE}`,
  415: `The request declares a character set the BFF cannot decode. ${AI_RELAYED_OR_ENVELOPE}`,
  429: `The Forest AI proxy rate-limited the query. ${AI_RELAYED_OR_ENVELOPE}`,
};

const AI_ENVELOPE_ERRORS: Record<string, string> = {
  500: 'The BFF hit an unexpected error, or the Forest server answered a 500 whose body is withheld',
  502: 'The Forest server could not be reached, or answered a status the BFF does not relay',
  503: 'The Forest server reported itself unavailable',
  504: 'The Forest server did not answer the AI query before the BFF timeout',
};

const AI_DEFAULT_DESCRIPTION =
  'Any other status this relay can answer. Below 500 the body is the Forest AI proxy answer, ' +
  'relayed unchanged when it was JSON and replaced by the BFF ' +
  '`{ error: { type, status, message } }` envelope when it was not. At 500 and above the body is ' +
  'always that envelope, so no upstream infrastructure detail reaches the caller. An upstream ' +
  'answer below 400 that carries no JSON body is reported as 502, since there is nothing to relay.';

const AI_COMPONENT_SUFFIX = 'AiQuery';

function registerAiQueryErrorResponses(registry: OpenAPIRegistry): Record<string, ResponseRef> {
  const dualShaped = Object.entries(AI_DUAL_SHAPED_ERRORS).map(([status, description]) => [
    status,
    registerErrorComponent(registry, `Error${status}${AI_COMPONENT_SUFFIX}`, {
      description,
      schema: {},
    }),
  ]);

  const envelope = Object.entries(AI_ENVELOPE_ERRORS).map(([status, description]) => [
    status,
    registerErrorComponent(registry, `Error${status}${AI_COMPONENT_SUFFIX}`, {
      description,
      schema: { $ref: ERROR_RESPONSE_REF },
    }),
  ]);

  return {
    ...Object.fromEntries([...dualShaped, ...envelope]),
    default: registerErrorComponent(registry, `ErrorDefault${AI_COMPONENT_SUFFIX}`, {
      description: AI_DEFAULT_DESCRIPTION,
      schema: {},
    }),
  };
}

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

// Registered as a parameter component rather than inlined: it is the same header on every path, and
// its description costs a quarter of a path once the error responses are refs.
const TIMEZONE_HEADER_COMPONENT = 'XForestTimezone';

const TIMEZONE_HEADER = z
  .string()
  .optional()
  .openapi({
    param: { name: 'X-Forest-Timezone', in: 'header' },
    description:
      'An IANA timezone. Takes precedence over the `timezone` body field; the BFF default ' +
      'applies when neither is sent.',
  });

const SHARED_DESCRIPTION =
  'The timezone is resolved from the `X-Forest-Timezone` header first, then a `timezone` body ' +
  'field, then the BFF default when one is configured. A deployment without a default rejects a ' +
  'request carrying neither with 400 missing_timezone, so send one of the two to be safe. Sending ' +
  'a content type other than application/json is not an error: a form-urlencoded body is parsed ' +
  'like JSON, while any other content type is read as absent, which silently drops any filter, ' +
  'sort, or page.';

const GENERIC_DESCRIPTION =
  'Paths are generic: one per operation, with the collection, relation and action passed as path ' +
  'segments, and no field enumerated. This is the fallback form — a deployment configured to ' +
  'reach its Forest schema and its agent unfolds one path per real collection, relation and ' +
  'action instead, each carrying its own field set.';

const UNFOLDED_DESCRIPTION =
  'Paths are unfolded: one per exposed collection, to-many relation and action, each carrying the ' +
  "collection's real field set. The RUNTIME routes stay generic — a path here is the generic " +
  'route with its segments already filled in, so the collection, relation and action segments are ' +
  'the exact schema names, URL-encoded. Every operationId is sanitized to stay usable as a ' +
  'method name, so the exact name lives in the summary and description. A path whose fields are ' +
  'not enumerated says so in its request description: the document was built without that ' +
  "collection's capabilities. Only to-many relations appear; a to-one or polymorphic relation has " +
  'no list or count route. This document describes the whole exposed schema regardless of the ' +
  'caller: it is not filtered by the permissions of whoever fetched it.';

function registerAiQueryPath(
  registry: OpenAPIRegistry,
  aiErrorRefs: Record<string, ResponseRef>,
): void {
  registry.registerPath({
    method: 'post',
    path: `${ROUTE_PREFIX}/ai/query`,
    operationId: 'aiQuery',
    summary: 'Relay an AI query to the Forest server',
    description:
      'Relays the body unchanged to the Forest AI proxy, authenticated with the OAuth session ' +
      'held by the BFF. Requires a session: an API key is rejected with 403 oauth_required, ' +
      'because only the OAuth flow yields the Forest access token this route forwards. The ' +
      'environment and rendering are derived server-side, so sending forest-* headers has no ' +
      `effect. The body limit is ${AI_BODY_LIMIT} here rather than the ${BODY_LIMIT} of every ` +
      'other route, and only application/json is parsed: any other content type arrives as an ' +
      'empty body, is relayed as {} and the Forest server rejects the query. This path is ' +
      'published only by a ' +
      'deployment whose OAuth configuration is complete, since the relay needs a session.',
    security: [{ [SESSION_SCHEME]: [] }],
    request: {
      body: { required: true, content: { 'application/json': { schema: AiQueryRequestSchema } } },
    },
    responses: {
      200: {
        description: 'The AI provider response, passed through unchanged',
        content: { 'application/json': { schema: z.unknown() } },
      },
      ...aiErrorRefs,
    },
  });
}

export interface GenerateOpenApiDocumentOptions {
  unfolding?: Unfolding;
  hasAiQueryRoute?: boolean;
}

export function generateOpenApiDocument(
  version: string,
  { unfolding, hasAiQueryRoute = false }: GenerateOpenApiDocumentOptions = {},
): OpenAPIObject {
  const registry = new OpenAPIRegistry();
  const hasActions =
    unfolding === undefined ||
    unfolding.collections.some(collection => collection.actions.length > 0);
  const errorRefs = registerErrorResponses(registry, DATA_ERRORS, hasActions);
  const aiErrorRefs = hasAiQueryRoute ? registerAiQueryErrorResponses(registry) : undefined;
  const timezoneHeader = [registry.registerParameter(TIMEZONE_HEADER_COMPONENT, TIMEZONE_HEADER)];

  registry.registerComponent('securitySchemes', SESSION_SCHEME, {
    type: 'http',
    scheme: 'bearer',
    description:
      'Mode 1: the BFF session token issued after the OAuth login. Accepted on the context ' +
      'contract and on every data and action route, where the BFF mints the agent token from the ' +
      'session. The session must carry a usable rendering, otherwise the request is rejected ' +
      'with 401.',
  });
  registry.registerComponent('securitySchemes', API_KEY_SCHEME, {
    type: 'apiKey',
    in: 'header',
    name: 'X-Forest-Bff-Key',
    description:
      'Mode 2: a BFF API key. Never send both this and an Authorization header. A key created ' +
      'with allowedOrigins restricts browser callers only: an Origin the client sends must be in ' +
      'that list, else 403 origin_not_allowed, while a request with no Origin at all — curl, a ' +
      'server-side client, CI — passes, because there the key is the boundary rather than the ' +
      'origin. The opaque Origin null is a present origin and is rejected.',
  });

  registry.registerPath({
    method: 'get',
    path: `${ROUTE_PREFIX}/context`,
    operationId: 'getContext',
    summary: 'Read the exposed schema contract',
    security: SECURITY,
    request: {},
    responses: {
      200: {
        description: 'The exposed schema: collections, typed fields, relations and actions',
        content: { 'application/json': { schema: ContextResponseSchema } },
      },
      400: errorRefs.byStatus['400'],
      401: errorRefs.byStatus['401'],
      403: errorRefs.byStatus['403'],
      500: errorRefs.byStatus['500'],
      501: errorRefs.byStatus['501'],
      503: errorRefs.byStatus['503'],
    },
  });

  if (aiErrorRefs) registerAiQueryPath(registry, aiErrorRefs);

  if (unfolding) {
    registerUnfoldedPaths(
      {
        registry,
        pool: new ComponentPool(registry),
        prefix: ROUTE_PREFIX,
        security: SECURITY,
        timezoneHeader,
        errorResponses: executeResults => errorResponses(errorRefs, executeResults),
      },
      unfolding,
    );
  } else {
    ROUTES.forEach(route => {
      registry.registerPath({
        method: 'post',
        path: `${ROUTE_PREFIX}${route.path}`,
        operationId: route.operationId,
        summary: route.summary,
        security: SECURITY,
        request: {
          params: buildParams(route.params),
          headers: timezoneHeader,
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
          ...errorResponses(errorRefs, route.executeResults === true),
        },
      });
    });
  }

  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: OPENAPI_VERSION,
    // Declared rather than left to first appearance: this is what fixes the order a viewer groups by,
    // and it gives a consumer the collection list without parsing paths for it. The generic document
    // has one operation per shape and nothing to group.
    tags: unfolding?.collections.map(collection => ({
      name: collection.name,
      description: `Records, relations and actions of the ${JSON.stringify(
        collection.name,
      )} collection.`,
    })),
    info: {
      title: 'Forest BFF',
      version,
      license: { name: 'GPL-3.0', url: 'https://www.gnu.org/licenses/gpl-3.0.html' },
      description: `${
        unfolding ? UNFOLDED_DESCRIPTION : GENERIC_DESCRIPTION
      } ${SHARED_DESCRIPTION}`,
    },
    servers: [{ url: '/' }],
  });
}

export function serializeOpenApi(document: OpenAPIObject): string {
  return JSON.stringify(document, null, 2);
}
