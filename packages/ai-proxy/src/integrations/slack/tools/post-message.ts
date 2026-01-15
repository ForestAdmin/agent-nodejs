import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

export default function createPostMessageTool(
  headers: Record<string, string>,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'slack_post_message',
    description: 'Post a new message to a Slack channel',
    schema: z.object({
      channel_id: z.string().describe('The ID of the channel to post to'),
      text: z.string().describe('The message text to post'),
    }),
    func: async ({ channel_id, text }) => {
      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          channel: channel_id,
          text,
        }),
      });

      return JSON.stringify(await response.json());
    },
  });
}
