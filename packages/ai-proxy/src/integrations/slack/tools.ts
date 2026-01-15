import RemoteTool from '../../remote-tool';
import createAddReactionTool from './tools/add-reaction';
import createGetChannelHistoryTool from './tools/get-channel-history';
import createGetThreadRepliesTool from './tools/get-thread-replies';
import createGetUserProfileTool from './tools/get-user-profile';
import createGetUsersTool from './tools/get-users';
import createListChannelsTool from './tools/list-channels';
import createPostMessageTool from './tools/post-message';
import createReplyToThreadTool from './tools/reply-to-thread';

export interface SlackConfig {
  authToken: string;
  teamId: string;
  channelIds?: string;
}

export default function getSlackTools(config: SlackConfig): RemoteTool[] {
  const headers = {
    Authorization: `Bearer ${config.authToken}`,
    'Content-Type': 'application/json',
  };

  return [
    createListChannelsTool(headers, config),
    createPostMessageTool(headers),
    createReplyToThreadTool(headers),
    createAddReactionTool(headers),
    createGetChannelHistoryTool(headers),
    createGetThreadRepliesTool(headers),
    createGetUsersTool(headers, config.teamId),
    createGetUserProfileTool(headers),
  ].map(
    tool =>
      new RemoteTool({
        sourceId: 'slack',
        sourceType: 'server',
        tool,
      }),
  );
}
