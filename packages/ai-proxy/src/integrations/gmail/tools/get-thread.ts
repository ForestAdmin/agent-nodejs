import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

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

      const messages = data.messages.map((msg: any) => {
        const getHeader = (name: string) =>
          msg.payload?.headers?.find(
            (h: { name: string; value: string }) =>
              h.name.toLowerCase() === name.toLowerCase(),
          )?.value || '';

        return {
          id: msg.id,
          subject: getHeader('Subject'),
          from: getHeader('From'),
          to: getHeader('To'),
          date: getHeader('Date'),
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
