import RemoteTool from '../../remote-tool';
import createDraftTool from './tools/create-draft';
import createGetMessageTool from './tools/get-message';
import createGetThreadTool from './tools/get-thread';
import createSearchTool from './tools/search';
import createSendMessageTool from './tools/send-message';

export interface GmailConfig {
  accessToken: string;
}

export default function getGmailTools(config: GmailConfig): RemoteTool[] {
  const headers = {
    Authorization: `Bearer ${config.accessToken}`,
    'Content-Type': 'application/json',
  };

  return [
    createSendMessageTool(headers),
    createGetMessageTool(headers),
    createSearchTool(headers),
    createDraftTool(headers),
    createGetThreadTool(headers),
  ].map(
    tool =>
      new RemoteTool({
        sourceId: 'gmail',
        sourceType: 'server',
        tool,
      }),
  );
}
