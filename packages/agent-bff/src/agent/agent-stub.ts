import type { Middleware } from 'koa';

import { buildAgentQuery } from './build-agent-query';

export default function createAgentStubMiddleware(): Middleware {
  return async function agentStubMiddleware(ctx) {
    const query = buildAgentQuery({ timezone: ctx.state.timezone as string });
    ctx.state.agentQuery = query;

    ctx.status = 501;
    ctx.body = {
      error: {
        type: 'not_implemented',
        status: 501,
        message: 'Agent proxy is not implemented yet',
      },
    };
  };
}
