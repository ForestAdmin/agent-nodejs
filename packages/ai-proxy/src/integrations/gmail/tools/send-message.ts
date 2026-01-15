import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

export default function createSendMessageTool(
  headers: Record<string, string>,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'gmail_send_message',
    description: 'Send an email message via Gmail',
    schema: z.object({
      to: z.array(z.string()).describe('Array of recipient email addresses'),
      subject: z.string().describe('Email subject line'),
      message: z.string().describe('Email body content'),
      cc: z.array(z.string()).optional().describe('Array of CC email addresses'),
      bcc: z.array(z.string()).optional().describe('Array of BCC email addresses'),
    }),
    func: async ({ to, subject, message, cc, bcc }) => {
      const emailLines = [
        `To: ${to.join(', ')}`,
        ...(cc ? [`Cc: ${cc.join(', ')}`] : []),
        ...(bcc ? [`Bcc: ${bcc.join(', ')}`] : []),
        `Subject: ${subject}`,
        '',
        message,
      ];

      const email = emailLines.join('\r\n');
      const encodedEmail = Buffer.from(email)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const response = await fetch(
        'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            raw: encodedEmail,
          }),
        },
      );

      return JSON.stringify(await response.json());
    },
  });
}
