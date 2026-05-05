import type { SnowflakeConfig } from './tools';

import { AIBadRequestError, AIToolUnprocessableError, McpConnectionError } from '../../errors';

const READ_ONLY_LEADING_KEYWORD_RE = /^\s*(select|show|describe|desc|explain)\b/i;
const FORBIDDEN_KEYWORD_RE =
  /\b(insert|delete|merge|drop|create|alter|truncate|rename|undrop|swap|grant|revoke|call|execute|copy|put|get|use|set|unset|begin|commit|rollback|with)\b/i;

export function getSnowflakeAuthHeaders(config: SnowflakeConfig): Record<string, string> {
  return {
    Authorization: `Bearer ${config.programmaticAccessToken}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Snowflake-Authorization-Token-Type': 'PROGRAMMATIC_ACCESS_TOKEN',
  };
}

export function getSnowflakeValidationBaseUrl(accountIdentifier: string): string {
  return `https://${accountIdentifier}.snowflakecomputing.com`;
}

export function buildSessionContext(config: SnowflakeConfig) {
  return {
    ...(config.defaultWarehouse && { warehouse: config.defaultWarehouse }),
    ...(config.defaultDatabase && { database: config.defaultDatabase }),
    ...(config.defaultSchema && { schema: config.defaultSchema }),
    ...(config.defaultRole && { role: config.defaultRole }),
  };
}

// Single-pass lexer: a regex pipeline cannot disambiguate `--` inside a string
// from a comment containing `'`, so it is unsafe for security checks.
function normalizeSql(statement: string): string {
  let result = '';
  let i = 0;

  while (i < statement.length) {
    const c = statement[i];
    const next = statement[i + 1];

    if (c === '/' && next === '*') {
      const end = statement.indexOf('*/', i + 2);

      i = end === -1 ? statement.length : end + 2;
    } else if (c === '-' && next === '-') {
      const end = statement.indexOf('\n', i + 2);

      i = end === -1 ? statement.length : end;
    } else if (c === "'" || c === '"') {
      result += c === "'" ? "''" : '""';
      i += 1;

      while (i < statement.length) {
        if (statement[i] === c && statement[i + 1] === c) {
          i += 2;
        } else if (statement[i] === c) {
          i += 1;
          break;
        } else {
          i += 1;
        }
      }
    } else {
      result += c;
      i += 1;
    }
  }

  return result.trim();
}

export function assertReadOnlySql(statement: string): void {
  const normalized = normalizeSql(statement);

  if (!normalized) {
    throw new AIBadRequestError('SQL statement is empty');
  }

  const withoutTrailingSemicolon = normalized.replace(/;\s*$/, '');

  if (withoutTrailingSemicolon.includes(';')) {
    throw new AIBadRequestError(
      'Only a single SQL statement is allowed. Multiple statements are not permitted.',
    );
  }

  if (!READ_ONLY_LEADING_KEYWORD_RE.test(withoutTrailingSemicolon)) {
    throw new AIBadRequestError(
      'Only read-only statements (SELECT, SHOW, DESCRIBE, EXPLAIN) are allowed.',
    );
  }

  const forbiddenMatch = withoutTrailingSemicolon.match(FORBIDDEN_KEYWORD_RE);

  if (forbiddenMatch) {
    throw new AIBadRequestError(
      `SQL statement contains a disallowed keyword: ${forbiddenMatch[0].toUpperCase()}`,
    );
  }
}

async function extractErrorMessage(response: Response): Promise<string> {
  const fallback = response.statusText || 'Unknown error';

  try {
    const json = await response.json();

    return json.message || json.error || json.code || fallback;
  } catch {
    return fallback;
  }
}

export async function assertResponseOk(response: Response, action: string) {
  if (response.ok) return;

  const errorMessage = await extractErrorMessage(response);

  throw new AIToolUnprocessableError(
    `Snowflake ${action} failed (${response.status}): ${errorMessage}`,
  );
}

export async function validateSnowflakeConfig(config: SnowflakeConfig) {
  const baseUrl = getSnowflakeValidationBaseUrl(config.accountIdentifier);
  const headers = getSnowflakeAuthHeaders(config);
  const body = {
    statement: 'SELECT 1',
    ...buildSessionContext(config),
  };
  const url = `${baseUrl}/api/v2/statements`;

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (response.ok) return;

  const errorMessage = await extractErrorMessage(response);

  throw new McpConnectionError(
    `Failed to validate Snowflake config (HTTP ${response.status} on ${url}): ${errorMessage}`,
  );
}
