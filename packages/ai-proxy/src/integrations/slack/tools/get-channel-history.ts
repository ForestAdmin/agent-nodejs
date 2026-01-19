import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

export default function createGetChannelHistoryTool(
  headers: Record<string, string>,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'slack_get_channel_history',
    description: 'Get recent messages from a channel',
    schema: z.object({
      channel_id: z.string().describe('The ID of the channel'),
      limit: z
        .number()
        .optional()
        .default(10)
        .describe('Number of messages to retrieve (default 10)'),
    }),
    func: async ({ channel_id, limit }) => {
      const params = new URLSearchParams({
        channel: channel_id,
        limit: limit.toString(),
      });
      const response = await fetch(`https://slack.com/api/conversations.history?${params}`, {
        headers,
      });

      return JSON.stringify(await response.json());
    },
  });
}
