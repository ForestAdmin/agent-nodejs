import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

import { getBody, getHeader } from './utils';

export default function createGetThreadTool(
  headers: Record<string, string>,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'gmail_get_thread',
    description: 'Get a complete email thread (conversation) by thread ID from Gmail',
    schema: z.object({
      thread_id: z.string().describe('The ID of the thread to retrieve'),
    }),
    func: async ({ thread_id }) => {
      const response = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/threads/${thread_id}?format=full`,
        {
          method: 'GET',
          headers,
        },
      );

      const data = await response.json();

      if (!data.messages) {
        return JSON.stringify({ error: 'Thread not found or no messages' });
      }

      const messages = data.messages.map((msg: any) => {
        return {
          id: msg.id,
          subject: getHeader(msg.payload, 'Subject'),
          from: getHeader(msg.payload, 'From'),
          to: getHeader(msg.payload, 'To'),
          date: getHeader(msg.payload, 'Date'),
          body: getBody(msg.payload),
        };
      });

      return JSON.stringify({
        threadId: data.id,
        messageCount: messages.length,
        messages,
      });
    },
  });
}
