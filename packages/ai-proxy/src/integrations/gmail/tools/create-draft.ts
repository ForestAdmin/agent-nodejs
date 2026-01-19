import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

import { encodeEmail } from './utils';

export default function createDraftTool(headers: Record<string, string>): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'gmail_create_draft',
    description: 'Create a draft email in Gmail',
    schema: z.object({
      to: z.array(z.string()).describe('Array of recipient email addresses'),
      subject: z.string().describe('Email subject line'),
      message: z.string().describe('Email body content'),
      cc: z.array(z.string()).optional().describe('Array of CC email addresses'),
      bcc: z.array(z.string()).optional().describe('Array of BCC email addresses'),
    }),
    func: async ({ to, subject, message, cc, bcc }) => {
      const encodedEmail = encodeEmail({ to, subject, message, cc, bcc });

      const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: {
            raw: encodedEmail,
          },
        }),
      });

      return JSON.stringify(await response.json());
    },
  });
}
