export type RegisteredToolConfig = {
  title: string;
  description: string;
  inputSchema: unknown;
  annotations?: { readOnlyHint?: boolean };
};
