import jsonwebtoken from 'jsonwebtoken';

export interface GenerateTokenOptions {
  envSecret?: string;
  authSecret?: string;
  token?: string;
  renderingId?: string;
  expiresIn?: string;
  forestServerUrl?: string;
}

interface UserInfoResponse {
  data: {
    id: string;
    attributes: {
      email: string;
      first_name: string;
      last_name: string;
      teams: string[];
      role: string;
      permission_level: string;
      tags?: Array<{ key: string; value: string }>;
    };
  };
}

// PAT structure from Forest Admin personal access tokens
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
  meta?: { renderingId?: number };
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

async function fetchUserInfo(
  forestServerUrl: string,
  renderingId: number,
  pat: string,
  envSecret: string,
): Promise<UserInfoResponse> {
  const url = `${forestServerUrl}/liana/v2/renderings/${renderingId}/authorization`;

  let response: Response;

  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        'forest-token': pat,
        'forest-secret-key': envSecret,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    throw new Error(
      `Failed to connect to Forest Admin API at ${forestServerUrl}: ` +
        `${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Authentication failed. Check your env secret and token.');
    }

    if (response.status === 404) {
      throw new Error('Could not find rendering. Check that your token matches the environment.');
    }

    let body: string;

    try {
      body = await response.text();
    } catch {
      body = '(could not read response body)';
    }

    throw new Error(`Forest Admin API error (HTTP ${response.status}): ${body.slice(0, 500)}`);
  }

  try {
    return (await response.json()) as UserInfoResponse;
  } catch (error) {
    throw new Error(
      `Failed to parse Forest Admin API response: ` +
        `${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function buildUserInfoFromPat(decoded: DecodedPat, renderingId: number): Record<string, unknown> {
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

async function buildUserInfoFromApi(
  decoded: DecodedPat,
  forestServerUrl: string,
  pat: string,
  envSecret: string,
): Promise<{ userInfo: Record<string, unknown>; renderingId: number }> {
  if (!decoded.meta?.renderingId) {
    throw new Error('Token does not contain a renderingId (expected in meta.renderingId).');
  }

  const { renderingId } = decoded.meta;
  const userInfoResponse = await fetchUserInfo(forestServerUrl, renderingId, pat, envSecret);

  if (!userInfoResponse.data?.attributes) {
    throw new Error(
      'Unexpected API response structure. This may indicate an API version mismatch.',
    );
  }

  const { attributes } = userInfoResponse.data;
  const userId = Number(userInfoResponse.data.id);

  if (!attributes.email) {
    throw new Error('API response is missing the user email. Cannot generate a valid MCP token.');
  }

  if (Number.isNaN(userId)) {
    throw new Error(`API response contains an invalid user ID: "${userInfoResponse.data.id}".`);
  }

  return {
    renderingId,
    userInfo: {
      id: userId,
      email: attributes.email,
      firstName: attributes.first_name,
      lastName: attributes.last_name,
      team: attributes.teams?.[0],
      role: attributes.role,
      permissionLevel: attributes.permission_level,
      renderingId,
      tags: attributes.tags
        ? Object.fromEntries(attributes.tags.map(({ key, value }) => [key, value]))
        : undefined,
    },
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
    forestServerUrl = 'https://api.forestadmin.com',
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

  let userInfo: Record<string, unknown>;

  if (decoded.isApplicationToken) {
    // PAT: user info is embedded in the token, renderingId must be provided via flag
    const renderingId = renderingIdStr ? Number(renderingIdStr) : undefined;

    if (!renderingId || Number.isNaN(renderingId)) {
      throw new Error(
        '--rendering-id is required when using a personal access token. ' +
          'Find it in your Forest Admin project URL: app.forestadmin.com/<projectId>/<renderingId>/...',
      );
    }

    userInfo = buildUserInfoFromPat(decoded, renderingId);
  } else {
    // OAuth-style token: fetch user info from the API
    const result = await buildUserInfoFromApi(decoded, forestServerUrl, pat, envSecret);
    userInfo = result.userInfo;
  }

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
