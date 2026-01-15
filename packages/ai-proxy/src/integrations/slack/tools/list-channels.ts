import type { SlackConfig } from '../tools';

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

export default function createListChannelsTool(
  headers: Record<string, string>,
  config: SlackConfig,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'slack_list_channels',
    description: 'List public or pre-defined channels in the workspace with pagination',
    schema: z.object({
      limit: z
        .number()
        .optional()
        .default(100)
        .describe('Maximum number of channels to return (default 100, max 200)'),
      cursor: z.string().optional().describe('Pagination cursor for next page of results'),
    }),
    func: async ({ limit, cursor }) => {
      const { channelIds } = config;

      if (!channelIds) {
        const params = new URLSearchParams({
          types: 'public_channel',
          exclude_archived: 'true',
          limit: Math.min(limit, 200).toString(),
          team_id: config.teamId,
        });

        if (cursor) {
          params.append('cursor', cursor);
        }

        const response = await fetch(`https://slack.com/api/conversations.list?${params}`, {
          headers,
        });

        return JSON.stringify(await response.json());
      }

      const predefinedChannelIdsArray = channelIds.split(',').map(id => id.trim());

      const channelPromises = predefinedChannelIdsArray.map(async channelId => {
        const params = new URLSearchParams({
          channel: channelId,
        });
        const response = await fetch(`https://slack.com/api/conversations.info?${params}`, {
          headers,
        });

        return response.json();
      });

      const results = await Promise.all(channelPromises);
      const channels = results
        .filter(data => data.ok && data.channel && !data.channel.is_archived)
        .map(data => data.channel);

      return JSON.stringify({
        ok: true,
        channels,
        response_metadata: { next_cursor: '' },
      });
    },
  });
}
