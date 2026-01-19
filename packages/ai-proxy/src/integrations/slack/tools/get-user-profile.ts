import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

export default function createGetUserProfileTool(
  headers: Record<string, string>,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'slack_get_user_profile',
    description: 'Get detailed profile information for a specific user',
    schema: z.object({
      user_id: z.string().describe('The ID of the user'),
    }),
    func: async ({ user_id }) => {
      const params = new URLSearchParams({
        user: user_id,
        include_labels: 'true',
      });
      const response = await fetch(`https://slack.com/api/users.profile.get?${params}`, {
        headers,
      });

      return JSON.stringify(await response.json());
    },
  });
}
