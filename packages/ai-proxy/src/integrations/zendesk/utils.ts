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

  const json = await response.json();

  if (!response.ok) {
    throw new McpConnectionError(
      `Failed to validate Zendesk config: ${json.title || json.error.title}`,
    );
  }
}
