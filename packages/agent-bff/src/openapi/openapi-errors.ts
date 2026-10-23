import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import type { ReferenceObject, SchemaObject } from 'openapi3-ts/oas31';

import {
  ErrorResponseSchema,
  MessagelessErrorResponseSchema,
  OpenapiDisabledErrorResponseSchema,
} from './schemas';
import { RATE_LIMIT_CAUSES } from '../http/bff-local-errors';
import BODY_LIMIT, { AI_BODY_LIMIT } from '../http/body-limit';

const ERROR_STATUSES: Record<string, string> = {
  400: 'Malformed body, a malformed URL-encoded path segment, an invalid filter operator, a filter nested too deep, ambiguous credentials, an unsupported page, a missing or invalid timezone, an unknown submitted action field, a required action field left empty or a malformed file value at execute, or a rejected action form (type action_error)',
  401: 'Missing, invalid, or expired credentials',
  403: 'The action needs approval before it runs (the body carries the approving roles), the Forest identity behind the API key is not allowed, the plan of the project does not include the Gateway API (type plan_feature_missing), the origin is not allowed for this key, the Forest server refused to write the activity log the request needs (type audit_not_authorized), or the agent refused the collection, relation, or action',
  404: 'Unknown collection, relation, or action',
  413: `The request body exceeds the Gateway API limit of ${BODY_LIMIT}`,
  415: 'The request Content-Type is neither application/json nor an application/*+json type, including form-urlencoded, and is rejected with 415 instead of being silently dropped; a request carrying a body with no Content-Type at all is rejected the same way; or the declared character set cannot be decoded',
  422: 'A field is unknown, not filterable, is a nested relation path, or an action value at execute is outside its enum or of the wrong type',
  429: `The Gateway API rate-limited the request, for one of two reasons: the caller identity exceeded its per-window budget, or the limiter is saturated and cannot open a window for a new identity. The \`details.cause\` field of the error body distinguishes them (\`${RATE_LIMIT_CAUSES.limitExceeded}\` or \`${RATE_LIMIT_CAUSES.limiterSaturated}\`), and Retry-After carries the seconds to wait. On data and action routes the agent may also rate-limit the request itself; that 429 is relayed with the agent's own payload as \`details\`, so it carries neither \`cause\` nor Retry-After — read them only when they are present rather than branching on their value`,
  500: 'The agent payload could not be mapped to the Gateway API contract, or the Gateway API hit an unexpected error',
  501: 'The Gateway API is running without an agent configured, so the proxy is not implemented',
  502: 'The agent refused the connection, its host could not be resolved, or the transport failed another way (a connection reset mid-flight, a socket hang up, a TLS failure) — it failed outright rather than running out of time',
  503: 'The agent schema is unavailable, the agent returned a 5xx, the API key could not be resolved, the activity log an action execution must be recorded in could not be written, so the action was not run (type audit_unavailable), or the Forest permissions could not be fetched and no fresh cache was left (type permissions_unavailable)',
  504: 'The agent did not answer before the Gateway API timeout (BFF_AGENT_TIMEOUT_MS, 10s by default). The deadline is armed when the request starts, so at the default it also covers a host that accepts nothing and never resets the connection — raise the timeout past the OS connect timeout and that case reverts to 502',
};

const UNSUPPORTED_RESULT_DESCRIPTION =
  'Either the Gateway API runs without an agent configured, or the action returned a result shape the ' +
  'Gateway API cannot normalize. The second case carries no message field.';

const ERROR_RESPONSE_REF = '#/components/schemas/ErrorResponse';
const MESSAGELESS_ERROR_RESPONSE_REF = '#/components/schemas/MessagelessErrorResponse';
const OPENAPI_DISABLED_RESPONSE_REF = '#/components/schemas/OpenapiDisabledErrorResponse';

const UNSUPPORTED_ACTION_RESULT_COMPONENT = 'UnsupportedActionResult';

const OPENAPI_DISABLED_COMPONENT = 'Error404OpenapiDisabled';

const OPENAPI_DISABLED_DESCRIPTION =
  'The deployment runs with `BFF_OPENAPI_ENABLED=false`, so the document is not served over HTTP.';

const retryAfterHeader = (description: string) => ({
  'Retry-After': {
    description,
    required: false,
    schema: { type: 'integer' as const },
  },
});

const RETRY_AFTER_HEADER = retryAfterHeader(
  'Seconds to wait before retrying. Set when the Gateway API could not reach the Forest server — an ' +
    'unresolvable API key, or permissions it could not fetch.',
);

const RETRY_AFTER_RATE_LIMIT_HEADER = retryAfterHeader(
  'Seconds until the Gateway API rate-limit window of the caller resets. When the limiter is ' +
    'saturated the caller has no window yet, so the value is a lower bound instead: the ' +
    'earliest reset among the identities currently holding one, after which a slot may free ' +
    'up. Present when the Gateway API itself emitted this 429; an agent 429 relayed from upstream ' +
    'carries no header.',
);

export const HEAD_DOCUMENT_RESPONSES = {
  200: { description: 'The document exists and is readable; no body is returned for HEAD' },
  400: { description: ERROR_STATUSES['400'] },
  401: { description: ERROR_STATUSES['401'] },
  403: { description: ERROR_STATUSES['403'] },
  404: { description: `${OPENAPI_DISABLED_DESCRIPTION} The status is the same as the GET one.` },
  429: { description: ERROR_STATUSES['429'], headers: RETRY_AFTER_RATE_LIMIT_HEADER },
  500: { description: ERROR_STATUSES['500'] },
  503: { description: ERROR_STATUSES['503'], headers: RETRY_AFTER_HEADER },
};

export type ResponseRef = { $ref: string };

export interface ErrorResponseRefs {
  byStatus: Record<string, ResponseRef>;
  unsupportedActionResult: ResponseRef;
  openapiDisabled: ResponseRef;
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
function retryAfterHeaders(status: string): { headers?: typeof RETRY_AFTER_HEADER } {
  if (status === '503') return { headers: RETRY_AFTER_HEADER };
  if (status === '429') return { headers: RETRY_AFTER_RATE_LIMIT_HEADER };

  return {};
}

export function registerErrorResponses(
  registry: OpenAPIRegistry,
  statuses: string[],
  withActionResults: boolean,
): ErrorResponseRefs {
  registry.register('ErrorResponse', ErrorResponseSchema);
  registry.register('OpenapiDisabledErrorResponse', OpenapiDisabledErrorResponseSchema);

  const byStatus: Record<string, ResponseRef> = {};
  const openapiDisabled = registerErrorComponent(registry, OPENAPI_DISABLED_COMPONENT, {
    description: `${OPENAPI_DISABLED_DESCRIPTION} The body is typed \`openapi_disabled\`, and the schema pins that value so a generated client can tell this 404 from any other; a bare 404 with no typed body means the agent edge is not mounted at all.`,
    schema: { $ref: OPENAPI_DISABLED_RESPONSE_REF },
  });

  statuses.forEach(status => {
    const description = ERROR_STATUSES[status];

    if (!description) throw new Error(`No OpenAPI description for error status ${status}`);

    byStatus[status] = registerErrorComponent(registry, `Error${status}`, {
      description,
      schema: { $ref: ERROR_RESPONSE_REF },
      ...retryAfterHeaders(status),
    });
  });

  // A document with no action path must not carry this response, nor the messageless body it
  // references: an unreferenced component trips redocly's unused-component rule.
  if (!withActionResults) {
    return { byStatus, openapiDisabled, unsupportedActionResult: byStatus['501'] };
  }

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

  return { byStatus, openapiDisabled, unsupportedActionResult };
}

export function errorResponses(
  refs: ErrorResponseRefs,
  executeResults: boolean,
): Record<string, ResponseRef> {
  return executeResults
    ? { ...refs.byStatus, 501: refs.unsupportedActionResult }
    : { ...refs.byStatus };
}

export const DATA_ERRORS = [
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
  '504',
];

const AI_RELAYED_OR_ENVELOPE =
  'Below 500 the Gateway API relays whatever JSON the Forest AI proxy answered, unchanged, so the authority ' +
  'on this body is the upstream contract and not the Gateway API one. When the upstream answer carried no ' +
  'JSON body, the Gateway API substitutes its own `{ error: { type, status, message } }` envelope at the ' +
  'same status. A consumer must accept either shape.';

const AI_DUAL_SHAPED_ERRORS: Record<string, string> = {
  400: `The Gateway API could not parse the body as JSON, or the Forest AI proxy rejected the query. ${AI_RELAYED_OR_ENVELOPE}`,
  401: `The Gateway API session is missing, invalid or expired, or the Forest server refused the access token this route forwards. ${AI_RELAYED_OR_ENVELOPE}`,
  403: `The request presented an API key instead of a session (type oauth_required), or the Forest server refused the query. ${AI_RELAYED_OR_ENVELOPE}`,
  413: `The request body exceeds the AI query limit of ${AI_BODY_LIMIT}, or the Forest AI proxy refused it as too large. ${AI_RELAYED_OR_ENVELOPE}`,
  415: `The request Content-Type is neither application/json nor an application/*+json type, or the request carries a body with no Content-Type at all, or it declares a character set the Gateway API cannot decode. ${AI_RELAYED_OR_ENVELOPE}`,
  429: `The Gateway API rate-limited the request (its own envelope, with Retry-After), or the Forest AI proxy rate-limited the query. ${AI_RELAYED_OR_ENVELOPE}`,
};

const AI_ENVELOPE_ERRORS: Record<string, string> = {
  500: 'The Gateway API hit an unexpected error, or the Forest server answered a 500 whose body is withheld',
  502: 'The Forest server could not be reached, or answered a status the Gateway API does not relay',
  503: 'The Forest server reported itself unavailable',
  504: 'The Forest server did not answer the AI query before the Gateway API timeout',
};

const AI_DEFAULT_DESCRIPTION =
  'Any other status this relay can answer. Below 500 the body is the Forest AI proxy answer, ' +
  'relayed unchanged when it was JSON and replaced by the Gateway API ' +
  '`{ error: { type, status, message } }` envelope when it was not. At 500 and above the body is ' +
  'always that envelope, so no upstream infrastructure detail reaches the caller. An upstream ' +
  'answer below 400 that carries no JSON body is reported as 502, since there is nothing to relay.';

const AI_COMPONENT_SUFFIX = 'AiQuery';

export function registerAiQueryErrorResponses(
  registry: OpenAPIRegistry,
): Record<string, ResponseRef> {
  const dualShaped = Object.entries(AI_DUAL_SHAPED_ERRORS).map(([status, description]) => [
    status,
    registerErrorComponent(registry, `Error${status}${AI_COMPONENT_SUFFIX}`, {
      description,
      schema: {},
      headers: status === '429' ? RETRY_AFTER_RATE_LIMIT_HEADER : undefined,
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
