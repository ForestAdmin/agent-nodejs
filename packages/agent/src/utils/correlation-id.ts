import type { Context, Next } from 'koa';

import { v4 as uuidv4 } from 'uuid';

export const CORRELATION_ID_HEADER = 'x-forest-correlation-id';

// Namespaced so it cannot collide with an identifier a host application places on `context.state`.
const STATE_KEY = 'forestRequestId';

export function getRequestId(context: Context): string {
  if (!context.state[STATE_KEY]) {
    context.state[STATE_KEY] = uuidv4();
  }

  return context.state[STATE_KEY] as string;
}

export async function correlationIdMiddleware(context: Context, next: Next): Promise<void> {
  try {
    await next();
  } finally {
    if (context.state[STATE_KEY]) {
      context.response.set(CORRELATION_ID_HEADER, context.state[STATE_KEY] as string);
    }
  }
}
