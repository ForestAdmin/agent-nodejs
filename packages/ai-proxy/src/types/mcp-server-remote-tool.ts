import type { StructuredToolInterface } from '@langchain/core/tools';

import RemoteTool from './remote-tool';

export default class McpServerRemoteTool<ToolType = unknown> extends RemoteTool {
  constructor(options: { tool: StructuredToolInterface<ToolType>; sourceId?: string }) {
    super({ ...options, sourceType: 'mcp-server' });
  }
}
