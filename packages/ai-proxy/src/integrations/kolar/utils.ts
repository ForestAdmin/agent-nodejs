import type { KolarConfig } from './tools';

import { McpConnectionError } from '../../errors';

const BASE_URL = 'https://backend-partners.up.railway.app';

export function getKolarConfig({ apiKey }: KolarConfig) {
  const headers = {
    'X-Api-Key': apiKey,
    'Content-Type': 'application/json',
  };

  return { baseUrl: BASE_URL, headers };
}

export async function assertResponseOk(response: Response, action: string) {
  if (!response.ok) {
    let errorMessage = response.statusText || 'Unknown error';

    try {
      const json = await response.json();
      errorMessage = json.error || json.message || json.description || errorMessage;
    } catch {
      // Response body is not JSON
    }

    throw new Error(`Kolar ${action} failed (${response.status}): ${errorMessage}`);
  }
}

export async function validateKolarConfig(config: KolarConfig) {
  const { baseUrl, headers } = getKolarConfig(config);

  const response = await fetch(`${baseUrl}/auth/verify`, { headers });

  if (!response.ok) {
    let errorMessage = response.statusText || 'Unknown error';

    try {
      const json = await response.json();
      errorMessage = json.message || json.error || errorMessage;
    } catch {
      // Response body is not JSON
    }

    throw new McpConnectionError(`Failed to validate Kolar config: ${errorMessage}`);
  }
}
