import type { StructuredToolInterface } from '@langchain/core/tools';

export type SourceType = 'server' | 'mcp-server';

export default class RemoteTool<ToolType = unknown> {
  base: StructuredToolInterface<ToolType>;
  sourceId: string;
  sourceType: SourceType;

  constructor(options: {
    tool: StructuredToolInterface<ToolType>;
    sourceId?: string;
    sourceType?: SourceType;
  }) {
    this.base = options.tool;
    this.sourceId = options.sourceId;
    this.sourceType = options.sourceType;
  }

  get sanitizedName() {
    return this.sanitizeName(this.base.name);
  }

  private sanitizeName(name: string): string {
    // OpenAI function names must be alphanumeric and can contain underscores
    // This function replaces non-alphanumeric characters with underscores
    return name.replace(/[^a-zA-Z0-9_-]/g, '_');
  }
}
