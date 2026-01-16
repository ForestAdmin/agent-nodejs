import type { StructuredToolInterface } from '@langchain/core/tools';

export default abstract class RemoteTool<ToolType = unknown> {
  base: StructuredToolInterface<ToolType>;
  sourceId: string;
  sourceType: string;

  constructor(options: {
    tool: StructuredToolInterface<ToolType>;
    sourceId?: string;
    sourceType?: string;
  }) {
    this.base = options.tool;
    this.sourceId = options.sourceId;
    this.sourceType = options.sourceType;
  }

  get sanitizedName() {
    // OpenAI function names must be alphanumeric and can contain underscores
    // This function replaces non-alphanumeric characters with underscores
    return this.base.name.replace(/[^a-zA-Z0-9_-]/g, '_');
  }
}
