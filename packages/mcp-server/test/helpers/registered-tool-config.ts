// Shape of the config object captured from `mcpServer.registerTool` in the tool tests —
// mirrors the fields the tests assert on (title / description / inputSchema / annotations).
export type RegisteredToolConfig = {
  title: string;
  description: string;
  inputSchema: unknown;
  annotations?: { readOnlyHint?: boolean };
};
