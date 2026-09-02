import type { Logger } from '../ports/logger-port';

import sanitizeActionHtml from './sanitize-action-html';

export interface ActionExecuteSuccessBody {
  type: 'success';
  message: string | null;
  invalidated: string[];
  html: string | null;
}

export interface ActionExecuteWebhookBody {
  type: 'webhook';
  url: unknown;
  method: unknown;
  headers: unknown;
  body: unknown;
}

export interface ActionExecuteRedirectBody {
  type: 'redirect';
  path: unknown;
}

export interface ActionExecuteUnsupportedBody {
  error: { type: 'unsupported_action_result'; status: 501 };
}

export type ActionExecuteMappedBody =
  | ActionExecuteSuccessBody
  | ActionExecuteWebhookBody
  | ActionExecuteRedirectBody
  | ActionExecuteUnsupportedBody;

export interface ActionExecuteMapped {
  status: number;
  body: ActionExecuteMappedBody;
}

interface AgentWebhookPayload {
  url: string;
  method: string;
  headers: unknown;
  body: unknown;
}

// The agent always serializes the four webhook fields together
// (`agent/src/routes/modification/action/action.ts`), so a payload missing url/method is malformed
// and must reach the 501 path rather than surface as a 200 the client cannot act on.
function isWebhook(value: unknown): value is AgentWebhookPayload {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;

  const { url, method } = value as Record<string, unknown>;

  return typeof url === 'string' && typeof method === 'string';
}

// The agent serializes a Success refresh as `{ relationships: [...] }`, so anything else (an array,
// a bare object without relationships) is malformed and must not act as the Success discriminator.
function isRefresh(value: unknown): value is { relationships: unknown[] } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;

  return Array.isArray((value as { relationships?: unknown }).relationships);
}

// Normalizes the agent's 200 execute payload into the flat BFF wrapper. The execute result is
// untyped at the BFF boundary (`Action.execute(): Promise<unknown>`), so we discriminate on the
// agent HTTP payload shape. A File result streams a binary with no JSON marker, so any unrecognized
// 200 body falls through to a structured 501 rather than being mislabelled.
export function mapActionExecuteResult(raw: unknown, logger: Logger): ActionExecuteMapped {
  const body = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;

  // Each branch validates the value shape, not just key presence: a malformed payload
  // (`{ webhook: null }`, `{ redirectTo: {} }`, `{ success: {} }`) must fall through to the 501
  // path rather than be surfaced as a 200 with null fields the client cannot tell from a real one.
  if (isWebhook(body.webhook)) {
    const { url, method, headers, body: hookBody } = body.webhook;

    return { status: 200, body: { type: 'webhook', url, method, headers, body: hookBody } };
  }

  if (typeof body.redirectTo === 'string') {
    return { status: 200, body: { type: 'redirect', path: body.redirectTo } };
  }

  // A Success carries a string message and/or a well-formed refresh; the agent always sends the
  // refresh, so a bare refresh (message absent) still normalizes to a success with a null message.
  if (typeof body.success === 'string' || isRefresh(body.refresh)) {
    const relationships = isRefresh(body.refresh) ? body.refresh.relationships : [];

    return {
      status: 200,
      body: {
        type: 'success',
        message: typeof body.success === 'string' ? body.success : null,
        invalidated: relationships.filter((name): name is string => typeof name === 'string'),
        html: sanitizeActionHtml(body.html, logger),
      },
    };
  }

  return { status: 501, body: { error: { type: 'unsupported_action_result', status: 501 } } };
}
