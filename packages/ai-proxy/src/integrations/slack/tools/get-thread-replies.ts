import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

export default function createGetThreadRepliesTool(
  headers: Record<string, string>,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'slack_get_thread_replies',
    description: 'Get all replies in a message thread',
    schema: z.object({
      channel_id: z.string().describe('The ID of the channel containing the thread'),
      thread_ts: z
        .string()
        .describe(
          "The timestamp of the parent message in the format '1234567890.123456'. " +
            'Timestamps in the format without the period can be converted by adding the period ' +
            'such that 6 numbers come after it.',
        ),
    }),
    func: async ({ channel_id, thread_ts }) => {
      const params = new URLSearchParams({
        channel: channel_id,
        ts: thread_ts,
      });
      const response = await fetch(`https://slack.com/api/conversations.replies?${params}`, {
        headers,
      });

      return JSON.stringify(await response.json());
    },
  });
}
