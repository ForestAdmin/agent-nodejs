import type { AddressInfo } from 'net';

import net from 'net';

export const AUTH_SECRET = 'auth-secret';
export const ALLOWED_ORIGIN = 'https://app.example.com';
export const ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');

export function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();

    probe.listen(0, () => {
      const { port } = probe.address() as AddressInfo;
      probe.close(() => resolve(port));
    });
    probe.on('error', reject);
  });
}

export function gatewayEnv(
  forestServerUrl: string,
  port: number,
  overrides: NodeJS.ProcessEnv = {},
): NodeJS.ProcessEnv {
  return {
    FOREST_GATEWAY_SERVICES: 'mcp,api',
    PORT: String(port),
    FOREST_ENV_SECRET: 'env-secret',
    FOREST_AUTH_SECRET: AUTH_SECRET,
    FOREST_SERVER_URL: forestServerUrl,
    FOREST_APP_URL: 'https://app.forestadmin.com',
    FOREST_AGENT_URL: 'https://agent.example.com',
    FOREST_GATEWAY_API_TOKEN_ENCRYPTION_KEY: ENCRYPTION_KEY,
    FOREST_GATEWAY_API_ALLOWED_ORIGINS: ALLOWED_ORIGIN,
    ...overrides,
  };
}
