import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

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

      const getHeader = (name: string) =>
        data.payload.headers?.find(
          (h: { name: string; value: string }) => h.name.toLowerCase() === name.toLowerCase(),
        )?.value || '';

      const decodeBody = (body: string) => {
        if (!body) return '';
        try {
          const sanitized = body.replace(/-/g, '+').replace(/_/g, '/');
          return Buffer.from(sanitized, 'base64').toString('utf-8');
        } catch {
          return '';
        }
      };

      const getBody = (payload: any): string => {
        if (payload.body?.data) {
          return decodeBody(payload.body.data);
        }
        if (payload.parts) {
          for (const part of payload.parts) {
            const body = getBody(part);
            if (body) return body;
          }
        }
        return '';
      };

      const result = {
        id: data.id,
        threadId: data.threadId,
        subject: getHeader('Subject'),
        from: getHeader('From'),
        to: getHeader('To'),
        date: getHeader('Date'),
        body: getBody(data.payload),
      };

      return JSON.stringify(result);
    },
  });
}
