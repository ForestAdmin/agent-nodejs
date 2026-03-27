import type RemoteTool from '../../remote-tool';
import type { ToolProvider } from '../../tool-provider';

import getBraveTools, { type BraveConfig } from './tools';

export default class BraveToolProvider implements ToolProvider {
  private readonly config: BraveConfig;

  constructor(config: BraveConfig) {
    this.config = config;
  }

  async loadTools(): Promise<RemoteTool[]> {
    return getBraveTools(this.config);
  }

  async checkConnection(): Promise<true> {
    return true;
  }

  // eslint-disable-next-line class-methods-use-this
  async dispose(): Promise<void> {
    // No-op: Brave search has no persistent connections
  }
}
