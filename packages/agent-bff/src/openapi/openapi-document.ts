import type { ErrorResponseRefs, ResponseRef } from './openapi-errors';
import type { Unfolding } from './unfolding';
import type { OpenAPIObject } from 'openapi3-ts/oas31';

import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';

import ComponentPool from './component-pool';
import {
  DATA_ERRORS,
  HEAD_DOCUMENT_RESPONSES,
  errorResponses,
  registerAiQueryErrorResponses,
  registerErrorResponses,
} from './openapi-errors';
import {
  ActionFormResponseSchema,
  ActionRequestSchema,
  ActionResultSchema,
  AiQueryRequestSchema,
  ContextResponseSchema,
  CountRequestSchema,
  CountResponseSchema,
  ListRequestSchema,
  ListResponseSchema,
  PermissionHintsSchema,
  RelationCountRequestSchema,
  RelationListRequestSchema,
} from './schemas';
import registerUnfoldedPaths from './unfolded-paths';
import { z } from './zod-openapi';
import { BFF_KEY_HEADER, GATEWAY_KEY_HEADER } from '../api-key/api-key-middleware';
import BODY_LIMIT, { AI_BODY_LIMIT } from '../http/body-limit';
import { PERMISSIONS_CACHE_TTL_MS } from '../permissions/permissions-cache';

export const OPENAPI_VERSION = '3.1.0';
export const ROUTE_PREFIX = '/agent/v1';
export const DOCUMENT_PATH = '/agent/openapi.json';

const SESSION_SCHEME = 'bffSession';
const API_KEY_SCHEME = 'bffApiKey';

const SECURITY = [{ [SESSION_SCHEME]: [] }, { [API_KEY_SCHEME]: [] }];

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
    response: ActionFormResponseSchema,
    responseDescription:
      'The action form fields; htmlBlock layout content is sanitized server-side against an allowlist before relaying',
    params: ['collection', 'action'],
    bodyRequired: true,
  },
  {
    path: '/{collection}/actions/{action}/execute',
    operationId: 'executeAction',
    summary: 'Execute a custom action',
    request: ActionRequestSchema,
    response: ActionResultSchema,
    responseDescription:
      'The normalized action result; a success result html field is sanitized server-side against an allowlist before relaying',
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
      'An IANA timezone. Takes precedence over the `timezone` body field; the Gateway API default ' +
      'applies when neither is sent.',
  });

const SHARED_DESCRIPTION =
  'The timezone is resolved from the `X-Forest-Timezone` header first, then a `timezone` body ' +
  'field, then the Gateway API default when one is configured. A deployment without a default rejects a ' +
  'request carrying neither with 400 missing_timezone, so send one of the two to be safe. Agent ' +
  'routes read application/json (and application/*+json) bodies only: any other Content-Type, ' +
  'form-urlencoded included, is rejected with 415 instead of being read as an absent body, and ' +
  'so is a body sent with no Content-Type at all. A bodyless POST needs no Content-Type.';

const SURFACE_DESCRIPTION =
  'Only the auth-gated `/agent` surface is described here. Three live route families are ' +
  'deliberately absent because they sit outside that surface and outside its auth edge: the ' +
  '`/health` probe (`GET` and `HEAD`), which answers 200 `ok` or 503 `degraded` to an ' +
  'unauthenticated request; the `/oauth/*` login routes; and the unauthenticated `/docs` viewer ' +
  'that renders this very document — `GET` and `HEAD` on the page and on its public ' +
  '`redoc.standalone.js` bundle. The package README documents all three.';

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

function registerPermissionsPath(
  registry: OpenAPIRegistry,
  errorRefs: ErrorResponseRefs,
  timezoneHeader: ReturnType<OpenAPIRegistry['registerParameter']>[],
): void {
  registry.registerPath({
    method: 'get',
    path: `${ROUTE_PREFIX}/permissions`,
    operationId: 'getPermissionHints',
    summary: 'Read what the caller may see and do, as display hints',
    description:
      'Answers for the caller behind the credentials, so two callers get two different payloads. ' +
      'The hints come from the Forest permissions, cached for ' +
      `${
        PERMISSIONS_CACHE_TTL_MS / 60_000
      } minutes, so they lag a change made in Forest. The agent runs with ` +
      '`instantCacheRefresh` by default, so its own cache has no meaningful expiry — about a year — ' +
      'and freshness rides on the Forest event stream: as long as those events reach it, the agent ' +
      'enforces the new permission while these hints are still stale. If the stream is cut — a ' +
      'reverse proxy that swallows it, which the agent logs once at subscribe time when the first ' +
      'heartbeat never arrives — the agent can hold the old permission far longer than these ' +
      'hints, and the hints are then the fresher of the two. An agent ' +
      'explicitly configured with `instantCacheRefresh: false` caches for ' +
      '`permissionsCacheDurationInSeconds` — 15 minutes by default, configurable with a 60-second ' +
      'floor — independently of these hints. That agent refetches on a denial, so a newly GRANTED ' +
      'permission lands on the next call while these hints still hide it; only a REVOKED one ' +
      'lingers agent-side until the cache expires. A 503 here is `permissions_unavailable` or ' +
      '`key_resolution_unavailable`, which always carry Retry-After, or `schema_unavailable`, ' +
      'which does not. Unlike the context and document routes, and the AI-query relay where it is ' +
      'published, this one sits behind the ' +
      'timezone middleware even though it reads no timezone, so a deployment with no configured ' +
      'default answers 400 `missing_timezone` unless `X-Forest-Timezone` is sent.',
    security: SECURITY,
    request: {
      query: z.object({
        collections: z
          .union([z.string(), z.array(z.string())])
          .optional()
          .openapi({
            description:
              'Comma-separated collection names to restrict the answer to, repeatable — a ' +
              'repeated parameter is joined with commas before being split again, so both forms ' +
              'behave the same. Absent means every exposed collection. Entries are trimmed and ' +
              'deduplicated, and a name the schema does not expose is dropped silently rather ' +
              'than rejected — so an empty `collections` object means none of the names matched.',
          }),
      }),
      headers: timezoneHeader,
    },
    responses: {
      200: {
        description: 'The display hints for the caller role',
        content: { 'application/json': { schema: PermissionHintsSchema } },
      },
      400: errorRefs.byStatus['400'],
      401: errorRefs.byStatus['401'],
      403: errorRefs.byStatus['403'],
      429: errorRefs.byStatus['429'],
      500: errorRefs.byStatus['500'],
      501: errorRefs.byStatus['501'],
      503: errorRefs.byStatus['503'],
    },
  });
}

function registerDocumentPath(registry: OpenAPIRegistry, errorRefs: ErrorResponseRefs): void {
  registry.registerPath({
    method: 'get',
    path: DOCUMENT_PATH,
    operationId: 'getOpenApiDocument',
    summary: 'Read this document',
    description:
      'Serves this very document behind credentials, like every other `/agent` route: without ' +
      'them the schema it describes is not readable. Both auth modes reach it — a session or an ' +
      'API key — as they do on every data, action, context and permissions route; the AI-query ' +
      'relay, where it is published, is the one exception and takes a session only. `HEAD` is ' +
      'served identically. The ' +
      'answer is never cached (`Cache-Control: no-store`) and is regenerated when the Gateway API ' +
      'refreshes its schema, so a client can re-fetch it to pick up a new collection or field.',
    security: SECURITY,
    request: {},
    responses: {
      200: {
        description: 'The OpenAPI document of this Gateway API',
        content: { 'application/json': { schema: z.unknown() } },
      },
      400: errorRefs.byStatus['400'],
      401: errorRefs.byStatus['401'],
      403: errorRefs.byStatus['403'],
      404: errorRefs.openapiDisabled,
      429: errorRefs.byStatus['429'],
      500: errorRefs.byStatus['500'],
      503: errorRefs.byStatus['503'],
    },
  });

  registry.registerPath({
    method: 'head',
    path: DOCUMENT_PATH,
    operationId: 'headOpenApiDocument',
    summary: 'Probe this document without fetching it',
    description:
      'Same route as `GET`, answering the same statuses and headers with no body, so a client can ' +
      'probe whether the document is enabled and reachable before re-fetching it. The six error ' +
      'statuses below reuse the GET wording, which describes a JSON body no HEAD ever returns: ' +
      'read the status, not the type. The 200 and the 404 carry their own.',
    security: SECURITY,
    request: {},
    responses: HEAD_DOCUMENT_RESPONSES,
  });
}

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
      'held by the Gateway API. Requires a session: an API key is rejected with 403 oauth_required, ' +
      'because only the OAuth flow yields the Forest access token this route forwards. The ' +
      'environment and rendering are derived server-side, so sending forest-* headers has no ' +
      `effect. The body limit is ${AI_BODY_LIMIT} here rather than the ${BODY_LIMIT} of every ` +
      'other route, and only application/json and application/*+json are read: any other ' +
      'content type, and a body sent with none at all, is rejected with 415 before the relay. ' +
      'This path is published only by a deployment whose OAuth configuration is complete, ' +
      'since the relay needs a session.',
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

const CONFIGURED_SERVER_DESCRIPTION = 'The public base URL of this Gateway API deployment.';

// A self-hosted BFF cannot know its own external URL, and this document is also exported offline by
// the CLI, so the absolute form has to be configured. Not a server variable in the meantime: a
// generator that meets a templated url drops the base URL entirely instead of substituting the
// default, which leaves a client worse off than the root-relative form.
const RELATIVE_SERVER_DESCRIPTION =
  'Resolved against the URL this document was fetched from. Set BFF_PUBLIC_URL on the deployment ' +
  'to publish its absolute base URL here instead, which a client generated from an offline export ' +
  'needs.';

export interface GenerateOpenApiDocumentOptions {
  unfolding?: Unfolding;
  hasAiQueryRoute?: boolean;
  /** The deployment's own external base URL, from `BFF_PUBLIC_URL`. Takes precedence. */
  publicUrl?: string;
  /** Where the Gateway API answers from the caller's point of view. Empty when it owns the origin root. */
  basePath?: string;
}

export function generateOpenApiDocument(
  version: string,
  {
    unfolding,
    hasAiQueryRoute = false,
    publicUrl,
    basePath = '',
  }: GenerateOpenApiDocumentOptions = {},
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
      'Mode 1: the Gateway API session token issued after the OAuth login. Accepted on the context ' +
      'contract and on every data and action route, where the Gateway API mints the agent token from the ' +
      'session. The session must carry a usable rendering, otherwise the request is rejected ' +
      'with 401.',
  });
  registry.registerComponent('securitySchemes', API_KEY_SCHEME, {
    type: 'apiKey',
    in: 'header',
    name: GATEWAY_KEY_HEADER,
    description:
      `Mode 2: a Gateway API key. The legacy header ${BFF_KEY_HEADER} is still accepted; sending ` +
      'both with different keys is rejected with 400 ambiguous_credentials. Never send a key and ' +
      'an Authorization header. A key created ' +
      'with allowedOrigins restricts browser callers only: an Origin the client sends must be in ' +
      'that list, else 403 origin_not_allowed, while a request with no Origin at all — curl, a ' +
      'server-side client, CI, an empty Origin header counting as none — passes, because there ' +
      'the key is the boundary rather than the origin. The opaque Origin null is a present origin ' +
      'and is rejected.',
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
      429: errorRefs.byStatus['429'],
      500: errorRefs.byStatus['500'],
      501: errorRefs.byStatus['501'],
      503: errorRefs.byStatus['503'],
    },
  });

  registerPermissionsPath(registry, errorRefs, timezoneHeader);
  registerDocumentPath(registry, errorRefs);

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
      title: 'Forest Gateway API',
      version,
      license: { name: 'Apache-2.0', url: 'https://www.apache.org/licenses/LICENSE-2.0.html' },
      description: `${
        unfolding ? UNFOLDED_DESCRIPTION : GENERIC_DESCRIPTION
      } ${SHARED_DESCRIPTION} ${SURFACE_DESCRIPTION}`,
    },
    servers: [
      publicUrl
        ? { url: publicUrl, description: CONFIGURED_SERVER_DESCRIPTION }
        : { url: basePath || '/', description: RELATIVE_SERVER_DESCRIPTION },
    ],
  });
}

export function serializeOpenApi(document: OpenAPIObject): string {
  return JSON.stringify(document, null, 2);
}
