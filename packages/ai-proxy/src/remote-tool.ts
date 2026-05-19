import type { StructuredToolInterface } from '@langchain/core/tools';

export default abstract class RemoteTool<ToolType = unknown> {
  base: StructuredToolInterface<ToolType>;
  sourceId: string;
  sourceType: string;
  // Stable DB id of the originating config entry. Distinct from `sourceId`, which is the
  // human-readable server/integration name. Use `id` for cross-system references (e.g.
  // matching a workflow step's mcpServerId to its config); use `sourceId` for display.
  id?: string;

  constructor(options: {
    tool: StructuredToolInterface<ToolType>;
    sourceId?: string;
    sourceType?: string;
    id?: string;
  }) {
    this.base = options.tool;
    this.sourceId = options.sourceId;
    this.sourceType = options.sourceType;
    this.id = options.id;
  }

  get sanitizedName() {
    // OpenAI function names must be alphanumeric and can contain underscores
    // This function replaces non-alphanumeric characters with underscores
    return this.base.name.replace(/[^a-zA-Z0-9_-]/g, '_');
  }
}
