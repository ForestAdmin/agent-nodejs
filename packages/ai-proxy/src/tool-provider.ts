import type RemoteTool from './remote-tool';

export interface ToolProvider {
  loadTools(): Promise<RemoteTool[]>;
  checkConnection(): Promise<true>;
  dispose(): Promise<void>;
}
