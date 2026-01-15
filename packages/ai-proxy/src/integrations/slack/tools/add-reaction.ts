import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

export default function createAddReactionTool(
  headers: Record<string, string>,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'slack_add_reaction',
    description: 'Add a reaction emoji to a message',
    schema: z.object({
      channel_id: z.string().describe('The ID of the channel containing the message'),
      timestamp: z.string().describe('The timestamp of the message to react to'),
      reaction: z.string().describe('The name of the emoji reaction (without ::)'),
    }),
    func: async ({ channel_id, timestamp, reaction }) => {
      const response = await fetch('https://slack.com/api/reactions.add', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          channel: channel_id,
          timestamp,
          name: reaction,
        }),
      });

      return JSON.stringify(await response.json());
    },
  });
}
