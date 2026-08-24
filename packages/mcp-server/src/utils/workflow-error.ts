import type { Logger } from '../server';

import { HttpError } from '@forestadmin/forestadmin-client';

// A timeout is the one HttpError whose message is built client-side: ServerUtils interpolates the
// full Forest server URL into it. Every other HttpError message is either a fixed string or the
// server's own JSON:API detail, both of which are meant to be read.
const TIMEOUT_STATUS = 408;
const RATE_LIMITED_STATUS = 429;

/**
 * True when the error's message carries transport detail — the Forest server URL, an internal
 * host:port, a TLS chain. Anything that is not an `HttpError` reached us as a raw Node/superagent
 * error, so its message is unfit for a model's context.
 */
export function carriesTransportDetail(error: unknown): boolean {
  return !(error instanceof HttpError) || error.status === TIMEOUT_STATUS;
}

/**
 * True when retrying the same call could plausibly succeed. A 4xx that is neither a timeout nor a
 * rate-limit is the caller's own fault and will fail identically forever — telling a model to
 * retry one of those is what turns a bad argument into an endless loop.
 */
export function isRetryable(error: unknown): boolean {
  if (!(error instanceof HttpError)) return true;

  return (
    error.status < 400 ||
    error.status >= 500 ||
    error.status === TIMEOUT_STATUS ||
    error.status === RATE_LIMITED_STATUS
  );
}

/**
 * Closing advice for a refusal that will repeat. Shared so the three workflow tools tell a model
 * the same thing — the wording is the only signal it has that retrying is pointless.
 */
export const RETRY_WILL_NOT_HELP =
  'Retrying will not help: fix the request, or report it to your Forest administrator.';

/**
 * Turns a workflow transport failure into an error the model may see: the full cause always goes
 * to the operator log, a message carrying transport detail is replaced by `unavailableMessage`,
 * and a refusal that will repeat is told to stop.
 */
export default function toModelSafeError(
  error: unknown,
  {
    logger,
    context,
    unavailableMessage,
  }: { logger: Logger; context: string; unavailableMessage: string },
): Error {
  const detail = error instanceof Error ? error.message : String(error);

  logger('Error', `${context}: ${detail}`);

  if (carriesTransportDetail(error)) return new Error(unavailableMessage);

  // A 4xx that is neither a timeout nor a rate limit fails identically on every attempt. Handing a
  // model the bare reason leaves nothing saying so — and these are the tools it is told to poll, so
  // the loop it produces is the documented usage rather than a mistake.
  if (!isRetryable(error)) {
    return new Error(`${detail.replace(/\.$/, '')}. ${RETRY_WILL_NOT_HELP}`);
  }

  return new Error(detail);
}
