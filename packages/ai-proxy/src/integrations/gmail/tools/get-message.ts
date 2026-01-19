import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

import { getBody, getHeader } from './utils';

export default function createGetMessageTool(
  headers: Record<string, string>,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'gmail_get_message',
    description: 'Get a specific email message by ID from Gmail',
    schema: z.object({
      message_id: z.string().describe('The ID of the message to retrieve'),
    }),
    func: async ({ message_id }) => {
      const response = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message_id}?format=full`,
        {
          method: 'GET',
          headers,
        },
      );

      const data = await response.json();

      if (!data.payload) {
        return JSON.stringify({ error: 'Message not found or invalid payload' });
      }

      const result = {
        id: data.id,
        threadId: data.threadId,
        subject: getHeader(data.payload, 'Subject'),
        from: getHeader(data.payload, 'From'),
        to: getHeader(data.payload, 'To'),
        date: getHeader(data.payload, 'Date'),
        body: getBody(data.payload),
      };

      return JSON.stringify(result);
    },
  });
}
