import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

import { getBody, getHeader } from './utils';

export default function createSearchTool(headers: Record<string, string>): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'gmail_search',
    description:
      'Search for Gmail messages or threads using Gmail search query syntax. Returns message/thread IDs that can be used with other tools.',
    schema: z.object({
      query: z
        .string()
        .describe(
          'Gmail search query (e.g., "from:user@example.com", "subject:meeting", "is:unread")',
        ),
      max_results: z
        .number()
        .optional()
        .default(10)
        .describe('Maximum number of results (default: 10)'),
      resource: z
        .enum(['messages', 'threads'])
        .optional()
        .default('messages')
        .describe('Type of resource to search for (messages or threads)'),
    }),
    func: async ({ query, max_results = 10, resource = 'messages' }) => {
      const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/${resource}`);
      url.searchParams.set('q', query);
      url.searchParams.set('maxResults', max_results.toString());

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers,
      });

      const data = await response.json();

      if (resource === 'messages') {
        const messages = data.messages || [];

        if (messages.length === 0) {
          return JSON.stringify({ results: [], count: 0 });
        }

        const detailedMessages = await Promise.all(
          messages.map(async (msg: { id: string }) => {
            const msgResponse = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
              {
                method: 'GET',
                headers,
              },
            );
            const msgData = await msgResponse.json();

            return {
              id: msgData.id,
              threadId: msgData.threadId,
              subject: getHeader(msgData.payload, 'Subject'),
              from: getHeader(msgData.payload, 'From'),
              to: getHeader(msgData.payload, 'To'),
              date: getHeader(msgData.payload, 'Date'),
              snippet: msgData.snippet,
              body: getBody(msgData.payload)?.substring(0, 500),
            };
          }),
        );

        return JSON.stringify({ results: detailedMessages, count: detailedMessages.length });
      }

      const threads = data.threads || [];

      return JSON.stringify({ results: threads, count: threads.length });
    },
  });
}
