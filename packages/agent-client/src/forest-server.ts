export enum ActivityLogSource {
  BFF = 'BFF',
  MCP = 'MCP',
  WorkflowExecutor = 'WorkflowExecutor',
}

export const APPLICATION_SOURCE_HEADER = 'Forest-Application-Source';

export type ForestServerToken = string | (() => string | Promise<string>);

export interface ForestServerConnection {
  serverUrl: string;
  serverToken: ForestServerToken;
  renderingId: number | string;
}

export async function resolveServerToken(token: ForestServerToken): Promise<string> {
  return typeof token === 'function' ? token() : token;
}
