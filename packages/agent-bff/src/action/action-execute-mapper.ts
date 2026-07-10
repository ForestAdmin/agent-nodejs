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

// Normalizes the agent's 200 execute payload into the flat BFF wrapper. The native ActionResult
// union never reaches the BFF (agent-client `execute()` is typed `{ success, html? }`), so we
// discriminate on the agent HTTP payload shape. A File result streams a binary with no JSON marker,
// so any unrecognized 200 body falls through to a structured 501 rather than being mislabelled.
export function mapActionExecuteResult(raw: unknown): ActionExecuteMapped {
  const body = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;

  // Each branch validates the value shape, not just key presence: a malformed payload
  // (`{ webhook: null }`, `{ redirectTo: {} }`, `{ success: {} }`) must fall through to the 501
  // path rather than be surfaced as a 200 with null fields the client cannot tell from a real one.
  if (typeof body.webhook === 'object' && body.webhook !== null) {
    const hook = body.webhook as Record<string, unknown>;

    return {
      status: 200,
      body: {
        type: 'webhook',
        url: hook.url,
        method: hook.method,
        headers: hook.headers,
        body: hook.body,
      },
    };
  }

  if (typeof body.redirectTo === 'string') {
    return { status: 200, body: { type: 'redirect', path: body.redirectTo } };
  }

  const refresh = typeof body.refresh === 'object' && body.refresh !== null ? body.refresh : null;

  // A Success carries a string message and/or a refresh object; the agent always sends the refresh,
  // so a bare refresh (message absent) still normalizes to a success with a null message.
  if (typeof body.success === 'string' || refresh !== null) {
    const relationships = (refresh as { relationships?: unknown } | null)?.relationships;

    return {
      status: 200,
      body: {
        type: 'success',
        message: typeof body.success === 'string' ? body.success : null,
        invalidated: Array.isArray(relationships) ? (relationships as string[]) : [],
        html: typeof body.html === 'string' ? body.html : null,
      },
    };
  }

  return { status: 501, body: { error: { type: 'unsupported_action_result', status: 501 } } };
}
