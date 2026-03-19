import jsonwebtoken from 'jsonwebtoken';

export interface GenerateTokenOptions {
  envSecret?: string;
  authSecret?: string;
  token?: string;
  renderingId?: string;
  expiresIn?: string;
}

interface DecodedPat {
  isApplicationToken?: boolean;
  data?: {
    data?: {
      type?: string;
      id?: string;
      attributes?: {
        first_name?: string;
        last_name?: string;
        email?: string;
      };
    };
  };
  exp?: number;
}

const MAX_TOKEN_LIFETIME_SECONDS = 60 * 24 * 3600; // 60 days

const ENV_SECRET_REGEX = /^[0-9a-f]{64}$/;

function parseExpiresIn(value: string): number {
  const unitMatch = value.match(/^(\d+)\s*(s|m|h|d)$/);
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };

  let seconds: number;

  const plainNumber = parseInt(value, 10);

  if (unitMatch) {
    seconds = parseInt(unitMatch[1], 10) * multipliers[unitMatch[2]];
  } else if (!Number.isNaN(plainNumber) && String(plainNumber) === value) {
    seconds = plainNumber;
  } else {
    throw new Error(
      `Invalid --expires-in value: "${value}". Use a positive number (seconds) or a duration like "1h", "30m", "7d".`,
    );
  }

  if (seconds <= 0) {
    throw new Error('--expires-in must be a positive duration.');
  }

  return seconds;
}

function buildUserInfo(decoded: DecodedPat, renderingId: number): Record<string, unknown> {
  const attrs = decoded.data?.data?.attributes;
  const userId = Number(decoded.data?.data?.id);

  if (!attrs?.email) {
    throw new Error('Token does not contain valid user attributes.');
  }

  if (Number.isNaN(userId)) {
    throw new Error('Token does not contain a valid user ID.');
  }

  return {
    id: userId,
    email: attrs.email,
    firstName: attrs.first_name,
    lastName: attrs.last_name,
    renderingId,
  };
}

export async function generateToken(
  options: GenerateTokenOptions,
): Promise<{ token: string; warnings: string[] }> {
  const {
    envSecret,
    authSecret,
    token: pat,
    renderingId: renderingIdStr,
    expiresIn: expiresInStr = '1h',
  } = options;

  const warnings: string[] = [];

  if (!envSecret || !ENV_SECRET_REGEX.test(envSecret)) {
    throw new Error('FOREST_ENV_SECRET is invalid. Expected 64 hex characters.');
  }

  if (!authSecret) {
    throw new Error('FOREST_AUTH_SECRET is required.');
  }

  if (!pat) {
    throw new Error(
      'A personal access token is required. Provide it via --token or FOREST_PERSONAL_TOKEN.',
    );
  }

  const decoded = jsonwebtoken.decode(pat) as DecodedPat | null;

  if (!decoded || typeof decoded !== 'object') {
    throw new Error(
      'Could not decode token. Ensure it is a valid Forest Admin personal access token.',
    );
  }

  if (!decoded.isApplicationToken) {
    throw new Error(
      'Token is not a Forest Admin personal access token (missing isApplicationToken flag).',
    );
  }

  const now = Math.floor(Date.now() / 1000);

  if (decoded.exp && decoded.exp <= now) {
    throw new Error('Token has expired. Please generate a new personal access token.');
  }

  let expiresInSeconds = parseExpiresIn(expiresInStr);

  if (expiresInSeconds > MAX_TOKEN_LIFETIME_SECONDS) {
    warnings.push(
      `Requested expiration exceeds maximum of 60 days. Capping to ${MAX_TOKEN_LIFETIME_SECONDS} seconds (60 days).`,
    );
    expiresInSeconds = MAX_TOKEN_LIFETIME_SECONDS;
  }

  if (decoded.exp) {
    const patRemainingSeconds = decoded.exp - now;

    if (expiresInSeconds > patRemainingSeconds) {
      warnings.push(
        'The requested token lifetime exceeds the remaining lifetime of your personal access token. ' +
          'The MCP token will stop working when the personal access token expires.',
      );
    }
  }

  const renderingId = renderingIdStr ? Number(renderingIdStr) : undefined;

  if (!renderingId || Number.isNaN(renderingId)) {
    throw new Error(
      '--rendering-id is required. ' +
        'Find it in your Forest Admin project URL: app.forestadmin.com/<projectId>/<renderingId>/...',
    );
  }

  const userInfo = buildUserInfo(decoded, renderingId);

  let mcpToken: string;

  try {
    mcpToken = jsonwebtoken.sign(
      { ...userInfo, serverToken: pat, scopes: ['mcp:read', 'mcp:write', 'mcp:action'] },
      authSecret,
      { expiresIn: expiresInSeconds },
    );
  } catch (error) {
    throw new Error(
      `Failed to sign the MCP token. Check your --auth-secret value. ` +
        `Details: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  warnings.push(
    'Warning: The personal access token is embedded in the generated JWT (signed but not encrypted). ' +
      'Avoid storing it in logs or shell history.',
  );

  return { token: mcpToken, warnings };
}
