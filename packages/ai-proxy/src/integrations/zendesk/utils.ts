import type { ZendeskConfig } from './tools';

import { McpConnectionError } from '../../errors';

export function getZendeskConfig(config: ZendeskConfig) {
  const baseUrl = `https://${config.subdomain}.zendesk.com/api/v2`;
  const auth = Buffer.from(`${config.email}/token:${config.apiToken}`).toString('base64');
  const headers = {
    Authorization: `Basic ${auth}`,
    'Content-Type': 'application/json',
  };

  return { baseUrl, headers };
}

export async function validateZendeskConfig(config: ZendeskConfig) {
  const { baseUrl, headers } = getZendeskConfig(config);

  const response = await fetch(`${baseUrl}/users/me`, { headers });

  if (!response.ok) {
    let errorMessage = response.statusText || 'Unknown error';

    try {
      const json = await response.json();
      errorMessage = json.title || json.error?.title || errorMessage;
    } catch {
      // Response body is not JSON (e.g. HTML from gateway timeout)
    }

    throw new McpConnectionError(`Failed to validate Zendesk config: ${errorMessage}`);
  }
}
