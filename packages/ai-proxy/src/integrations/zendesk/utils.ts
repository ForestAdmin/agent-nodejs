import type { ZendeskConfig } from './tools';

import { AIBadRequestError, AIToolUnprocessableError, McpConnectionError } from '../../errors';
import fetchWithoutRedirect from '../fetch-without-redirect';

// A Zendesk subdomain is a single DNS label. Anything else could redirect URL building to an
// attacker-controlled host (e.g. `attack.com/x#` makes `#` start the URL fragment).
const SUBDOMAIN_RE = /^[A-Za-z0-9-]{1,63}$/;

export function assertValidSubdomain(subdomain: string): void {
  if (typeof subdomain !== 'string' || !SUBDOMAIN_RE.test(subdomain)) {
    throw new AIBadRequestError(`Invalid Zendesk subdomain: ${JSON.stringify(subdomain)}`);
  }
}

export function getZendeskConfig(config: ZendeskConfig) {
  assertValidSubdomain(config.subdomain);

  const baseUrl = `https://${config.subdomain}.zendesk.com/api/v2`;
  const auth = Buffer.from(`${config.email}/token:${config.apiToken}`).toString('base64');
  const headers = {
    Authorization: `Basic ${auth}`,
    'Content-Type': 'application/json',
  };

  return { baseUrl, headers };
}

export async function assertResponseOk(response: Response, action: string) {
  if (!response.ok) {
    let errorMessage = response.statusText || 'Unknown error';

    try {
      const json = await response.json();
      errorMessage = json.error || json.title || json.description || errorMessage;
    } catch {
      // Response body is not JSON
    }

    throw new AIToolUnprocessableError(
      `Zendesk ${action} failed (${response.status}): ${errorMessage}`,
    );
  }
}

export async function validateZendeskConfig(config: ZendeskConfig) {
  const { baseUrl, headers } = getZendeskConfig(config);

  const response = await fetchWithoutRedirect(`${baseUrl}/users/me`, { headers });

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
