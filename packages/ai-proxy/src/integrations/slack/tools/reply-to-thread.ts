import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

export default function createReplyToThreadTool(
  headers: Record<string, string>,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'slack_reply_to_thread',
    description: 'Reply to a specific message thread in Slack',
    schema: z.object({
      channel_id: z.string().describe('The ID of the channel containing the thread'),
      thread_ts: z
        .string()
        .describe(
          "The timestamp of the parent message in the format '1234567890.123456'. " +
            'Timestamps in the format without the period can be converted by adding the period ' +
            'such that 6 numbers come after it.',
        ),
      text: z.string().describe('The reply text'),
    }),
    func: async ({ channel_id, thread_ts, text }) => {
      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          channel: channel_id,
          thread_ts,
          text,
        }),
      });

      return JSON.stringify(await response.json());
    },
  });
}
