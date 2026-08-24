export type RegisteredToolConfig = {
  title: string;
  description: string;
  inputSchema: unknown;
  annotations?: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
};
