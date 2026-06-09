import { ZendeskApiError } from '../../errors';

const ALREADY_CLOSED_PATTERN = /closed prevents ticket update/i;

function hasAlreadyClosedSignature(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;

  const { details } = body as { details?: unknown };

  if (details && typeof details === 'object') {
    const statusErrors = (details as { status?: unknown }).status;

    if (Array.isArray(statusErrors)) {
      for (const item of statusErrors) {
        if (item && typeof item === 'object') {
          const { description } = item as { description?: unknown };

          if (typeof description === 'string' && ALREADY_CLOSED_PATTERN.test(description)) {
            return true;
          }
        }
      }
    }
  }

  const { description } = body as { description?: unknown };
  if (typeof description === 'string' && ALREADY_CLOSED_PATTERN.test(description)) return true;

  const { error } = body as { error?: unknown };
  if (typeof error === 'string' && ALREADY_CLOSED_PATTERN.test(error)) return true;

  return false;
}

/**
 * Zendesk surfaces "you cannot edit a closed ticket" as a 422 with a status-field
 * details entry containing the phrase below. We need to peel back the API error
 * envelope to detect it and report those tickets as already closed rather than failed.
 */
// eslint-disable-next-line import/prefer-default-export
export function isAlreadyClosedError(error: unknown): boolean {
  if (!(error instanceof ZendeskApiError)) return false;
  if (error.status !== 422) return false;

  return hasAlreadyClosedSignature(error.body);
}
