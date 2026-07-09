import type { Logger } from '../ports/logger-port';

import { AgentHttpError } from '@forestadmin/agent-client';

import { BffHttpError } from './bff-http-error';

const TYPE_INVALID_REQUEST = 'invalid_request';
const TYPE_VALIDATION_ERROR = 'validation_error';
const TYPE_UNAUTHORIZED = 'unauthorized';
const TYPE_FORBIDDEN = 'forbidden';
const TYPE_NOT_FOUND = 'not_found';
const TYPE_UNPROCESSABLE = 'unprocessable_entity';
const TYPE_TOO_MANY_REQUESTS = 'too_many_requests';
const TYPE_NETWORK_ERROR = 'network_error';
const TYPE_AGENT_UNAVAILABLE = 'agent_unavailable';

type BffErrorType =
  | typeof TYPE_INVALID_REQUEST
  | typeof TYPE_VALIDATION_ERROR
  | typeof TYPE_UNAUTHORIZED
  | typeof TYPE_FORBIDDEN
  | typeof TYPE_NOT_FOUND
  | typeof TYPE_UNPROCESSABLE
  | typeof TYPE_TOO_MANY_REQUESTS
  | typeof TYPE_NETWORK_ERROR
  | typeof TYPE_AGENT_UNAVAILABLE;

const DEFAULT_NETWORK_MESSAGE = 'The agent could not be reached';
const DEFAULT_UNAVAILABLE_MESSAGE = 'The agent is unavailable';
const DEFAULT_ERROR_MESSAGE = 'Unexpected error';

export const AGENT_ERROR_TYPE_MAP: Record<string, BffErrorType> = {
  ValidationError: TYPE_VALIDATION_ERROR,
  BadRequestError: TYPE_INVALID_REQUEST,
  UnauthorizedError: TYPE_UNAUTHORIZED,
  ForbiddenError: TYPE_FORBIDDEN,
  NotFoundError: TYPE_NOT_FOUND,
  UnprocessableError: TYPE_UNPROCESSABLE,
  TooManyRequestsError: TYPE_TOO_MANY_REQUESTS,
};

const FALLBACK_TYPE_BY_STATUS: Record<number, BffErrorType> = {
  400: TYPE_INVALID_REQUEST,
  401: TYPE_UNAUTHORIZED,
  403: TYPE_FORBIDDEN,
  404: TYPE_NOT_FOUND,
  422: TYPE_UNPROCESSABLE,
  429: TYPE_TOO_MANY_REQUESTS,
};

interface AgentJsonApiError {
  name?: string;
  detail?: string;
  message?: string;
  status?: number | string;
  data?: unknown;
}

function coerceStatus(status: number | string | undefined, fallback: number): number {
  const parsed = typeof status === 'string' ? Number(status) : status;

  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : fallback;
}

function fallbackTypeByStatus(status: number): BffErrorType {
  return FALLBACK_TYPE_BY_STATUS[status] ?? TYPE_INVALID_REQUEST;
}

function agentUnavailable(): BffHttpError {
  return new BffHttpError(503, TYPE_AGENT_UNAVAILABLE, DEFAULT_UNAVAILABLE_MESSAGE);
}

function firstJsonApiError(body: unknown): AgentJsonApiError | undefined {
  if (typeof body !== 'object' || body === null) return undefined;

  const { errors } = body as { errors?: unknown };

  return Array.isArray(errors) ? (errors[0] as AgentJsonApiError) : undefined;
}

function mapJsonApiError(
  agentError: AgentJsonApiError,
  fallbackStatus: number,
  logger: Logger,
): BffHttpError {
  const bodyStatus = coerceStatus(agentError.status, fallbackStatus);
  // Never surface an upstream failure as a 2xx/3xx: ignore a non-error body status.
  const status = bodyStatus >= 400 ? bodyStatus : fallbackStatus;

  // The wrapped-message path skips the outer AgentHttpError 5xx check, so normalize here too.
  if (status >= 500) return agentUnavailable();

  const message = agentError.detail ?? agentError.message ?? DEFAULT_ERROR_MESSAGE;
  const mappedType = agentError.name ? AGENT_ERROR_TYPE_MAP[agentError.name] : undefined;

  if (agentError.name && mappedType === undefined) {
    logger('Warn', 'Unmapped agent error name; using status-derived type', {
      name: agentError.name,
      status,
    });
  }

  return new BffHttpError(
    status,
    mappedType ?? fallbackTypeByStatus(status),
    message,
    agentError.data,
  );
}

function parseJsonApiFromMessage(error: unknown): AgentJsonApiError | undefined {
  if (!(error instanceof Error)) return undefined;

  try {
    return firstJsonApiError(JSON.parse(error.message));
  } catch {
    return undefined;
  }
}

function mapFlatBody(status: number, body: unknown, responseText?: string): BffHttpError {
  const flat = (typeof body === 'object' && body !== null ? body : {}) as {
    error?: unknown;
    message?: unknown;
  };
  const message =
    (typeof flat.error === 'string' ? flat.error : undefined) ??
    (typeof flat.message === 'string' ? flat.message : undefined) ??
    (typeof responseText === 'string' && responseText !== '' ? responseText : undefined) ??
    DEFAULT_ERROR_MESSAGE;

  return new BffHttpError(status, fallbackTypeByStatus(status), message);
}

export function mapAgentError(error: unknown, { logger }: { logger: Logger }): BffHttpError {
  if (!(error instanceof AgentHttpError)) {
    const agentError = parseJsonApiFromMessage(error);
    if (agentError) return mapJsonApiError(agentError, 400, logger);

    // No HTTP response: treated as a transport failure reaching the agent. Log the real cause but
    // return a generic message — transport errors embed internal topology (hostnames/IPs) that must
    // not leak to the client. Semantic agent-client errors (action form validation / approval
    // outcomes) are NOT transport failures: the action endpoint catches and maps those before this
    // fallback. Callers must scope their try/catch to the agent call so a local BFF bug surfaces as
    // a 500 through the error middleware rather than being mislabelled here.
    logger('Warn', 'Agent transport failure mapped to network_error', {
      cause: error instanceof Error ? error.message : String(error),
    });

    return new BffHttpError(502, TYPE_NETWORK_ERROR, DEFAULT_NETWORK_MESSAGE);
  }

  if (error.status >= 500) return agentUnavailable();

  const agentError = firstJsonApiError(error.body);
  if (agentError) return mapJsonApiError(agentError, error.status, logger);

  return mapFlatBody(error.status, error.body, error.responseText);
}
