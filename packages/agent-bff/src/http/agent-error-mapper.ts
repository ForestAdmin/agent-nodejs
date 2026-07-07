import type { Logger } from '../ports/logger-port';

import { AgentHttpError } from '@forestadmin/agent-client';

import { BffHttpError } from './bff-http-error';
import { mappingError } from './bff-local-errors';

const STATUS_BAD_REQUEST = 400;
const STATUS_UNAUTHORIZED = 401;
const STATUS_FORBIDDEN = 403;
const STATUS_NOT_FOUND = 404;
const STATUS_UNPROCESSABLE = 422;
const STATUS_TOO_MANY_REQUESTS = 429;
const STATUS_SERVER_ERROR = 500;
const STATUS_BAD_GATEWAY = 502;
const STATUS_SERVICE_UNAVAILABLE = 503;

const TYPE_INVALID_REQUEST = 'invalid_request';
const TYPE_VALIDATION_ERROR = 'validation_error';
const TYPE_UNAUTHORIZED = 'unauthorized';
const TYPE_FORBIDDEN = 'forbidden';
const TYPE_NOT_FOUND = 'not_found';
const TYPE_UNPROCESSABLE = 'unprocessable_entity';
const TYPE_TOO_MANY_REQUESTS = 'too_many_requests';
const TYPE_NETWORK_ERROR = 'network_error';
const TYPE_AGENT_UNAVAILABLE = 'agent_unavailable';

const DEFAULT_NETWORK_MESSAGE = 'The agent could not be reached';
const DEFAULT_UNAVAILABLE_MESSAGE = 'The agent is unavailable';
const DEFAULT_ERROR_MESSAGE = 'Unexpected error';

export const AGENT_ERROR_TYPE_MAP: Record<string, string> = {
  ValidationError: TYPE_VALIDATION_ERROR,
  BadRequestError: TYPE_INVALID_REQUEST,
  UnauthorizedError: TYPE_UNAUTHORIZED,
  ForbiddenError: TYPE_FORBIDDEN,
  NotFoundError: TYPE_NOT_FOUND,
  UnprocessableError: TYPE_UNPROCESSABLE,
  TooManyRequestsError: TYPE_TOO_MANY_REQUESTS,
};

const FALLBACK_TYPE_BY_STATUS: Record<number, string> = {
  [STATUS_BAD_REQUEST]: TYPE_INVALID_REQUEST,
  [STATUS_UNAUTHORIZED]: TYPE_UNAUTHORIZED,
  [STATUS_FORBIDDEN]: TYPE_FORBIDDEN,
  [STATUS_NOT_FOUND]: TYPE_NOT_FOUND,
  [STATUS_UNPROCESSABLE]: TYPE_UNPROCESSABLE,
  [STATUS_TOO_MANY_REQUESTS]: TYPE_TOO_MANY_REQUESTS,
};

interface AgentJsonApiError {
  name?: string;
  detail?: string;
  message?: string;
  status?: number;
  data?: unknown;
}

function fallbackTypeByStatus(status: number): string {
  return FALLBACK_TYPE_BY_STATUS[status] ?? TYPE_INVALID_REQUEST;
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
  const status = agentError.status ?? fallbackStatus;
  const message = agentError.detail ?? agentError.message ?? DEFAULT_ERROR_MESSAGE;

  if (agentError.name !== undefined) {
    const type = AGENT_ERROR_TYPE_MAP[agentError.name];

    if (type === undefined) {
      logger('Error', 'Unmapped agent error name', { name: agentError.name, status });

      return mappingError(`Unmapped agent error name: ${agentError.name}`);
    }

    return new BffHttpError(status, type, message, agentError.data);
  }

  return new BffHttpError(status, fallbackTypeByStatus(status), message, agentError.data);
}

function parseJsonApiFromMessage(error: unknown): AgentJsonApiError | undefined {
  if (!(error instanceof Error)) return undefined;

  try {
    return firstJsonApiError(JSON.parse(error.message));
  } catch {
    return undefined;
  }
}

function mapFlatBody(status: number, body: unknown): BffHttpError {
  const flat = (typeof body === 'object' && body !== null ? body : {}) as {
    error?: unknown;
    message?: unknown;
  };
  const message =
    (typeof flat.error === 'string' ? flat.error : undefined) ??
    (typeof flat.message === 'string' ? flat.message : undefined) ??
    DEFAULT_ERROR_MESSAGE;

  return new BffHttpError(status, fallbackTypeByStatus(status), message);
}

export function mapAgentError(error: unknown, { logger }: { logger: Logger }): BffHttpError {
  if (!(error instanceof AgentHttpError)) {
    const agentError = parseJsonApiFromMessage(error);
    if (agentError) return mapJsonApiError(agentError, STATUS_BAD_REQUEST, logger);

    const message = error instanceof Error ? error.message : DEFAULT_NETWORK_MESSAGE;

    return new BffHttpError(STATUS_BAD_GATEWAY, TYPE_NETWORK_ERROR, message);
  }

  if (error.status >= STATUS_SERVER_ERROR) {
    return new BffHttpError(
      STATUS_SERVICE_UNAVAILABLE,
      TYPE_AGENT_UNAVAILABLE,
      DEFAULT_UNAVAILABLE_MESSAGE,
    );
  }

  const agentError = firstJsonApiError(error.body);
  if (agentError) return mapJsonApiError(agentError, error.status, logger);

  return mapFlatBody(error.status, error.body);
}
