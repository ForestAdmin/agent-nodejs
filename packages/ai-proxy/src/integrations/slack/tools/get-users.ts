import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

export default function createGetUsersTool(
  headers: Record<string, string>,
  teamId: string,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'slack_get_users',
    description: 'Get a list of all users in the workspace with their basic profile information',
    schema: z.object({
      cursor: z.string().optional().describe('Pagination cursor for next page of results'),
      limit: z
        .number()
        .optional()
        .default(100)
        .describe('Maximum number of users to return (default 100, max 200)'),
    }),
    func: async ({ cursor, limit }) => {
      const params = new URLSearchParams({
        limit: Math.min(limit, 200).toString(),
        team_id: teamId,
      });

      if (cursor) {
        params.append('cursor', cursor);
      }

      const response = await fetch(`https://slack.com/api/users.list?${params}`, {
        headers,
      });

      return JSON.stringify(await response.json());
    },
  });
}
