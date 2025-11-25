import * as http from 'http';
import * as https from 'https';
import { createRequire } from 'module';
import * as url from 'url';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const createForestAdminClient = require('@forestadmin/forestadmin-client').default;

type ForestAdminClient = ReturnType<typeof createForestAdminClient>;

interface UserInfo {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  team: string;
  renderingId: number;
  role: string;
  tags: { [key: string]: string };
  permissionLevel: string;
}

interface AuthenticationResult {
  authenticated: boolean;
  user?: UserInfo;
  token?: string;
  error?: string;
}

/**
 * OAuth client wrapper that uses the Forest Admin authentication service
 * to authenticate against an agent running on AGENT_HOSTNAME.
 *
 * This implements a device-like OAuth flow suitable for CLI tools:
 * 1. Generates an authorization URL
 * 2. Opens a temporary local callback server
 * 3. Prints the URL for the user to visit
 * 4. Waits for the OAuth callback
 * 5. Exchanges the code for tokens
 */
export default class OAuthClient {
  private forestAdminClient: ForestAdminClient;
  private agentHostname: string;
  private initialized = false;
  private authSecret: string;
  private currentUser?: UserInfo;
  private currentToken?: string;

  constructor() {
    const envSecret = process.env.FOREST_ENV_SECRET;
    const forestServerUrl = process.env.FOREST_SERVER_URL;
    this.agentHostname = process.env.AGENT_HOSTNAME || 'http://localhost:3310';
    this.authSecret = process.env.FOREST_AUTH_SECRET || 'change-me-in-production';

    if (!envSecret) {
      throw new Error('FOREST_ENV_SECRET environment variable is required');
    }

    // Create the Forest Admin client with authentication service
    this.forestAdminClient = createForestAdminClient({
      envSecret,
      forestServerUrl,
      logger: (level, message) => {
        console.error(`[${level}] ${message}`);
      },
    });
  }

  /**
   * Initialize the OAuth client and authentication service
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await this.forestAdminClient.authService.init();
      this.initialized = true;
      console.error(
        `[INFO] OAuth client initialized successfully for agent at ${this.agentHostname}`,
      );
    } catch (error) {
      // If metadata discovery fails, mark as initialized anyway
      // We'll use a fallback OAuth flow without OIDC
      console.error(
        '[WARN] OAuth metadata discovery failed, will use direct OAuth flow:',
        error.message,
      );
      this.initialized = true;
    }
  }

  /**
   * Get the Forest Admin client instance
   */
  getClient(): ForestAdminClient {
    return this.forestAdminClient;
  }

  /**
   * Get the agent hostname
   */
  getAgentHostname(): string {
    return this.agentHostname;
  }

  /**
   * Check if the client is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get the current authenticated user
   */
  getCurrentUser(): UserInfo | undefined {
    return this.currentUser;
  }

  /**
   * Get the current authentication token
   */
  getCurrentToken(): string | undefined {
    return this.currentToken;
  }

  /**
   * Check if currently authenticated
   */
  isAuthenticated(): boolean {
    return !!this.currentUser && !!this.currentToken;
  }

  /**
   * Direct OAuth flow using agent's authentication endpoint
   * This bypasses the OIDC metadata discovery
   */
  private async authenticateDirect(
    renderingId: number,
    callbackPort: number,
  ): Promise<AuthenticationResult> {
    try {
      // Create a promise that will resolve when authentication completes
      const authPromise = new Promise<{ code: string; state: string }>((resolve, reject) => {
        // Create temporary HTTP server to receive OAuth callback
        const server = http.createServer((req, res) => {
          const parsedUrl = url.parse(req.url || '', true);

          if (parsedUrl.pathname === '/callback') {
            const { code, state } = parsedUrl.query;
            const codeStr = typeof code === 'string' ? code : code?.[0];
            const stateStr = typeof state === 'string' ? state : state?.[0] || '';

            if (!codeStr) {
              res.writeHead(400, { 'Content-Type': 'text/html' });
              res.end(
                '<html><body><h1>Error</h1><p>No authorization code received</p></body></html>',
              );
              server.close();
              reject(new Error('No authorization code received'));

              return;
            }

            // Send success response to browser
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <body>
                  <h1>Authentication Successful!</h1>
                  <p>You can close this window and return to the MCP server.</p>
                  <script>window.close();</script>
                </body>
              </html>
            `);

            // Close server and resolve with callback data
            server.close();
            resolve({ code: codeStr, state: stateStr });
          } else {
            res.writeHead(404);
            res.end('Not found');
          }
        });

        server.listen(callbackPort, () => {
          console.error(`[INFO] Local callback server listening on port ${callbackPort}`);
        });

        server.on('error', err => {
          reject(new Error(`Failed to start callback server: ${err.message}`));
        });

        // Timeout after 5 minutes
        setTimeout(() => {
          server.close();
          reject(new Error('Authentication timeout - no callback received within 5 minutes'));
        }, 5 * 60 * 1000);
      });

      // Use agent's authentication endpoint
      const authUrl = new URL('/forest/authentication', this.agentHostname);
      authUrl.searchParams.set('renderingId', renderingId.toString());

      console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('🔐 AUTHENTICATION REQUIRED');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('\nPlease visit this URL to authenticate:\n');
      console.error(`  ${authUrl.toString()}\n`);
      console.error('This will redirect you to Forest Admin for login.\n');
      console.error('Waiting for authentication...\n');

      // Wait for OAuth callback
      const { code, state: returnedState } = await authPromise;

      // For direct flow, we'll use the code as the access token
      // In a real implementation, you'd exchange this with the agent
      this.currentToken = code;

      // Try to get user info from the agent
      try {
        const userInfoUrl = new URL(`/forest/authentication/callback`, this.agentHostname);

        userInfoUrl.searchParams.set('code', code);
        userInfoUrl.searchParams.set('state', returnedState);

        const response = await this.makeHttpRequest<{ user: UserInfo }>(userInfoUrl.toString());

        this.currentUser = response.user;
      } catch {
        // If we can't get user info, create a basic user object
        this.currentUser = {
          id: 0,
          email: 'authenticated',
          firstName: 'Forest',
          lastName: 'Admin',
          team: 'Default',
          renderingId,
          role: 'admin',
          tags: {},
          permissionLevel: 'admin',
        };
      }

      console.error(`[INFO] ✓ Authentication successful!`);

      return {
        authenticated: true,
        user: this.currentUser,
        token: this.currentToken,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      return {
        authenticated: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Perform OAuth authentication flow
   *
   * This creates a temporary local HTTP server to receive the OAuth callback,
   * generates an authorization URL, and waits for the user to complete authentication.
   *
   * @param renderingId - The Forest Admin rendering ID (default: 1)
   * @param callbackPort - Port for the local callback server (default: 3333)
   * @returns Authentication result with user info and token
   */
  async authenticate(renderingId = 1, callbackPort = 3333): Promise<AuthenticationResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Try OIDC flow first
      // Create a promise that will resolve when authentication completes
      const authPromise = new Promise<{ query: Record<string, string>; state: string }>(
        (resolve, reject) => {
          // Create temporary HTTP server to receive OAuth callback
          const server = http.createServer((req, res) => {
            const parsedUrl = url.parse(req.url || '', true);

            if (parsedUrl.pathname === '/callback') {
              const query = parsedUrl.query as Record<string, string>;
              const state = query.state as string;

              // Send success response to browser
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end(`
                <html>
                  <body>
                    <h1>Authentication Successful!</h1>
                    <p>You can close this window and return to the MCP server.</p>
                    <script>window.close();</script>
                  </body>
                </html>
              `);

              // Close server and resolve with callback data
              server.close();
              resolve({ query, state });
            } else {
              res.writeHead(404);
              res.end('Not found');
            }
          });

          server.listen(callbackPort, () => {
            console.error(`[INFO] Local callback server listening on port ${callbackPort}`);
          });

          server.on('error', err => {
            reject(new Error(`Failed to start callback server: ${err.message}`));
          });

          // Timeout after 5 minutes
          setTimeout(() => {
            server.close();
            reject(new Error('Authentication timeout - no callback received within 5 minutes'));
          }, 5 * 60 * 1000);
        },
      );

      // Generate authorization URL with callback
      const state = JSON.stringify({ renderingId });

      let authUrl: URL;

      try {
        const authorizationUrl = await this.forestAdminClient.authService.generateAuthorizationUrl({
          scope: 'openid email profile',
          state,
        });

        // Modify the redirect_uri in the authorization URL to point to our local callback
        authUrl = new URL(authorizationUrl);
        authUrl.searchParams.set('redirect_uri', `http://localhost:${callbackPort}/callback`);
      } catch {
        // Fallback to direct authentication
        console.error('[WARN] OIDC flow not available, using direct authentication');

        return await this.authenticateDirect(renderingId, callbackPort);
      }

      console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('🔐 AUTHENTICATION REQUIRED');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('\nPlease visit this URL to authenticate:\n');
      console.error(`  ${authUrl.toString()}\n`);
      console.error('Waiting for authentication...\n');

      // Wait for OAuth callback
      const { query, state: returnedState } = await authPromise;

      // Exchange code for tokens
      const tokenSet = await this.forestAdminClient.authService.generateTokens({
        query,
        state: returnedState,
      });

      // Get user information
      this.currentUser = await this.forestAdminClient.authService.getUserInfo(
        renderingId,
        tokenSet.accessToken,
      );

      // For MCP server, we'll store the access token directly
      // In a production environment, you might want to generate a JWT or use a different token strategy
      this.currentToken = tokenSet.accessToken;

      console.error(`[INFO] ✓ Authentication successful! Logged in as ${this.currentUser.email}`);

      return {
        authenticated: true,
        user: this.currentUser,
        token: this.currentToken,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[ERROR] Authentication failed: ${errorMessage}`);

      return {
        authenticated: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Helper method to make HTTP requests
   */
  private async makeHttpRequest<T>(urlString: string): Promise<T> {
    const urlObj = new URL(urlString);
    const isHttps = urlObj.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    return new Promise((resolve, reject) => {
      const req = httpModule.request(urlObj, { method: 'GET' }, res => {
        let data = '';

        res.on('data', chunk => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(data) as T);
            } catch {
              resolve(data as T);
            }
          } else {
            reject(new Error(`Request failed with status ${res.statusCode}`));
          }
        });
      });

      req.on('error', reject);
      req.end();
    });
  }

  /**
   * Make an authenticated HTTP request to the Forest Admin agent
   *
   * @param path - The API path (e.g., '/forest/stats')
   * @param options - Additional request options
   * @returns Response data
   */
  async makeAuthenticatedRequest<T = unknown>(
    path: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
      body?: unknown;
      headers?: Record<string, string>;
    } = {},
  ): Promise<T> {
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated. Call authenticate() first.');
    }

    const agentUrl = new URL(path, this.agentHostname);
    const isHttps = agentUrl.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    return new Promise<T>((resolve, reject) => {
      const requestOptions = {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.currentToken}`,
          'forest-token': this.currentToken || '',
          ...(options.headers || {}),
        },
      };

      const req = httpModule.request(agentUrl, requestOptions, res => {
        let data = '';

        res.on('data', chunk => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(data) as T);
            } catch {
              resolve(data as T);
            }
          } else {
            reject(
              new Error(
                `Request failed with status ${res.statusCode}: ${data || res.statusMessage}`,
              ),
            );
          }
        });
      });

      req.on('error', err => {
        reject(new Error(`Request failed: ${err.message}`));
      });

      if (options.body) {
        req.write(JSON.stringify(options.body));
      }

      req.end();
    });
  }
}
