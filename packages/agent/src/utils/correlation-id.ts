import type { Context, Next } from 'koa';

import { v4 as uuidv4 } from 'uuid';

export const CORRELATION_ID_HEADER = 'x-forest-correlation-id';

export function getRequestId(context: Context): string {
  if (!context.state.requestId) {
    context.state.requestId = uuidv4();
  }

  return context.state.requestId as string;
}

export async function correlationIdMiddleware(context: Context, next: Next): Promise<void> {
  await next();

  if (context.state.requestId) {
    context.response.set(CORRELATION_ID_HEADER, context.state.requestId as string);
  }
}
