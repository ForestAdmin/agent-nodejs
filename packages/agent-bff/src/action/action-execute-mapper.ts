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

  if ('webhook' in body) {
    const hook = (
      typeof body.webhook === 'object' && body.webhook !== null ? body.webhook : {}
    ) as Record<string, unknown>;

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

  if ('redirectTo' in body) {
    return { status: 200, body: { type: 'redirect', path: body.redirectTo } };
  }

  if ('success' in body || 'refresh' in body) {
    const refresh = (
      typeof body.refresh === 'object' && body.refresh !== null ? body.refresh : {}
    ) as { relationships?: unknown };

    return {
      status: 200,
      body: {
        type: 'success',
        message: typeof body.success === 'string' ? body.success : null,
        invalidated: Array.isArray(refresh.relationships) ? (refresh.relationships as string[]) : [],
        html: typeof body.html === 'string' ? body.html : null,
      },
    };
  }

  return { status: 501, body: { error: { type: 'unsupported_action_result', status: 501 } } };
}
