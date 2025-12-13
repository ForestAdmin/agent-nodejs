/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  CollectionCustomizer,
  DataSourceChartDefinition,
  DataSourceCustomizer,
  DataSourceOptions,
  Plugin,
  TCollectionName,
  TSchema,
} from '@forestadmin/datasource-customizer';
import { DataSource, DataSourceFactory } from '@forestadmin/datasource-toolkit';
import { ForestSchema } from '@forestadmin/forestadmin-client';
import {
  McpHandlers,
  isMcpRoute,
  type AuthorizeParams,
  type McpHandlersOptions,
  type TokenParams,
} from '@forestadmin/mcp-server';
import bodyParser from '@koa/bodyparser';
import cors from '@koa/cors';
import Router from '@koa/router';
import { readFile, writeFile } from 'fs/promises';
import stringify from 'json-stringify-pretty-compact';

import FrameworkMounter from './framework-mounter';
import makeRoutes from './routes';
import makeServices, { ForestAdminHttpDriverServices } from './services';
import CustomizationService from './services/model-customizations/customization';
import { AgentOptions, AgentOptionsWithDefaults, McpOptions } from './types';
import SchemaGenerator from './utils/forest-schema/generator';
import OptionsValidator from './utils/options-validator';

/**
 * Allow to create a new Forest Admin agent from scratch.
 * Builds the application by composing and configuring all the collection decorators.
 *
 * Minimal code to add a datasource
 * @example
 * new AgentBuilder(options)
 *  .addDataSource(new SomeDataSource())
 *  .start();
 */
export default class Agent<S extends TSchema = TSchema> extends FrameworkMounter {
  protected options: AgentOptionsWithDefaults;
  protected customizer: DataSourceCustomizer<S>;
  protected nocodeCustomizer: DataSourceCustomizer<S>;
  protected customizationService: CustomizationService;
  protected schemaGenerator: SchemaGenerator;

  /** MCP options registered via useMcp() */
  private mcpOptions: McpOptions | null = null;

  /** MCP handlers instance */
  private mcpHandlers: McpHandlers | null = null;

  /**
   * Create a new Agent Builder.
   * If any options are missing, the default will be applied:
   * ```
   *  forestServerUrl: 'https://api.forestadmin.com',
   *  logger: (level, data) => console.error(level, data),
   *  prefix: 'api/v1',
   *  schemaPath: '.forestadmin-schema.json',
   *  permissionsCacheDurationInSeconds: 15 * 60,
   * ```
   * @param options options
   * @example
   * new AgentBuilder(options)
   *  .addDataSource(new DataSource())
   *  .start();
   */
  constructor(options: AgentOptions) {
    const allOptions = OptionsValidator.validate(OptionsValidator.withDefaults(options));
    super(allOptions.prefix, allOptions.logger);

    this.options = allOptions;
    this.customizer = new DataSourceCustomizer<S>({
      ignoreMissingSchemaElementErrors: options.ignoreMissingSchemaElementErrors || false,
    });
    this.customizationService = new CustomizationService(allOptions);
    this.schemaGenerator = new SchemaGenerator(allOptions);
  }

  /**
   * Start the agent.
   */
  async start(): Promise<void> {
    const { router, mcpRouter } = await this.buildRouterAndSendSchema();

    await this.options.forestAdminClient.subscribeToServerEvents();
    this.options.forestAdminClient.onRefreshCustomizations(this.restart.bind(this));

    this.setMcpRouter(mcpRouter ?? null);
    await this.mount(router);
  }

  /**
   * Stop the agent.
   */
  override async stop(): Promise<void> {
    // Close anything related to ForestAdmin client
    this.options.forestAdminClient.close();
    // Stop at framework level
    await super.stop();
  }

  /**
   * Restart the agent at runtime (remount routes).
   */
  async restart(): Promise<void> {
    // We force sending schema when restarting
    const { router, mcpRouter } = await this.buildRouterAndSendSchema();

    this.setMcpRouter(mcpRouter ?? null);
    await this.remount(router);
  }

  /**
   * Add a datasource
   * @param factory the datasource to add
   * @param options the options
   * @see {@link https://docs.forestadmin.com/developer-guide-agents-nodejs/data-sources/connection Documentation Link}
   */
  addDataSource(factory: DataSourceFactory, options?: DataSourceOptions): this {
    this.customizer.addDataSource(factory, options, this.restart.bind(this));

    return this;
  }

  /**
   * Update the typings files generated from your datasources
   * @param typingsPath the path at which to write the new file
   * @param typingsMaxDepth the max depth of relation typings
   * @see {@link https://docs.forestadmin.com/developer-guide-agents-nodejs/getting-started/install/autocompletion-and-typings Documentation Link}
   */
  async updateTypesOnFileSystem(typingsPath: string, typingsMaxDepth: number): Promise<void> {
    const { logger } = this.options;
    await this.customizer.getDataSource(logger);
    await this.customizer.updateTypesOnFileSystem(typingsPath, typingsMaxDepth);
  }

  /**
   * Create a new API chart
   * @param name name of the chart
   * @param definition definition of the chart
   * @see {@link https://docs.forestadmin.com/developer-guide-agents-nodejs/agent-customization/charts Documentation Link}
   * @example
   * .addChart('numCustomers', (context, resultBuilder) => {
   *   return resultBuilder.distribution({
   *     tomatoes: 10,
   *     potatoes: 20,
   *     carrots: 30,
   *   });
   * })
   */
  addChart(name: string, definition: DataSourceChartDefinition<S>): this {
    this.customizer.addChart(name, definition);

    return this;
  }

  /**
   * Allow to interact with a decorated collection
   * @param name the name of the collection to manipulate
   * @param handle a function that provide a collection builder on the given collection name
   * @see {@link https://docs.forestadmin.com/developer-guide-agents-nodejs/agent-customization/agent-customization Documentation Link}
   * @example
   * .customizeCollection('books', books => books.renameField('xx', 'yy'))
   */
  customizeCollection<N extends TCollectionName<S>>(
    name: N,
    handle: (collection: CollectionCustomizer<S, N>) => unknown,
  ): this {
    this.customizer.customizeCollection(name, handle);

    return this;
  }

  /**
   * Remove collections from the exported schema (they will still be usable within the agent).
   * @param names the collections to remove
   * @example
   * .removeField('aCollectionToRemove', 'anotherCollectionToRemove');
   */
  removeCollection(...names: TCollectionName<S>[]): this {
    this.customizer.removeCollection(...names);

    return this;
  }

  /**
   * Load a plugin across all collections
   * @param plugin instance of the plugin
   * @param options options which need to be passed to the plugin
   * @see {@link https://docs.forestadmin.com/developer-guide-agents-nodejs/agent-customization/plugins Documentation Link}
   * @example
   * import advancedExportPlugin from '@forestadmin/plugin-advanced-export';
   *
   * agent.use(advancedExportPlugin, { format: 'xlsx' });
   */
  use<Options>(plugin: Plugin<Options>, options?: Options): this {
    this.customizer.use(plugin, options);

    return this;
  }

  /**
   * Enable MCP (Model Context Protocol) server support.
   * This allows AI assistants to interact with your Forest Admin data.
   *
   * @param options Optional configuration for the MCP server
   * @example
   * agent.useMcp({ baseUrl: 'https://my-app.example.com' });
   */
  useMcp(options?: McpOptions): this {
    this.mcpOptions = options || {};

    return this;
  }

  protected getRoutes(dataSource: DataSource, services: ForestAdminHttpDriverServices) {
    return makeRoutes(dataSource, this.options, services);
  }

  /**
   * Create an http handler which can respond to all queries which are expected from an agent.
   * Returns the main router and optional MCP router.
   */
  private async getRouter(
    dataSource: DataSource,
  ): Promise<{ router: Router; mcpRouter?: Router }> {
    // Bootstrap app
    const services = makeServices(this.options);
    const routes = this.getRoutes(dataSource, services);

    await Promise.all(routes.map(route => route.bootstrap()));

    // Initialize MCP router if configured via useMcp()
    let mcpRouter: Router | undefined;

    if (this.mcpOptions !== null) {
      mcpRouter = await this.createMcpRouter();
    }

    // Build main router
    const router = new Router();
    router.all('(.*)', cors({ credentials: true, maxAge: 24 * 3600, privateNetworkAccess: true }));
    router.use(
      bodyParser({
        encoding: 'utf-8',
        jsonLimit: this.options.maxBodySize,
        parsedMethods: ['POST', 'PUT', 'PATCH', 'DELETE'],
        ...this.options.bodyParserOptions,
      }),
    );
    routes.forEach(route => route.setupRoutes(router));

    return { router, mcpRouter };
  }

  /**
   * Create a Koa router with MCP routes using the framework-agnostic handlers.
   */
  private async createMcpRouter(): Promise<Router> {
    const handlerOptions: McpHandlersOptions = {
      forestServerUrl: this.options.forestServerUrl,
      envSecret: this.options.envSecret,
      authSecret: this.options.authSecret,
      logger: this.options.logger,
    };

    // Reuse existing handlers instance or create new one
    if (!this.mcpHandlers) {
      this.mcpHandlers = new McpHandlers(handlerOptions);
      await this.mcpHandlers.initialize();
    }

    const handlers = this.mcpHandlers;

    // Determine base URL
    const baseUrl = this.mcpOptions?.baseUrl
      ? new URL('/', this.mcpOptions.baseUrl)
      : handlers.getBaseUrl();

    if (!baseUrl) {
      throw new Error(
        'Could not determine base URL for MCP server. ' +
          'Either provide a baseUrl option to useMcp() or ensure the Forest Admin environment has an api_endpoint configured.',
      );
    }

    // Create router with MCP routes
    const router = new Router();

    // CORS for MCP routes
    router.use(cors({ credentials: true }));

    // Body parser for MCP routes
    router.use(
      bodyParser({
        encoding: 'utf-8',
        parsedMethods: ['POST'],
      }),
    );

    // OAuth metadata endpoint (RFC 8414)
    router.get('/.well-known/oauth-authorization-server', ctx => {
      ctx.body = handlers.getOAuthMetadata(baseUrl);
    });

    // OAuth protected resource metadata (RFC 9728)
    router.get('/.well-known/oauth-protected-resource', ctx => {
      ctx.body = handlers.getProtectedResourceMetadata(baseUrl);
    });

    // Authorization endpoint
    router.get('/oauth/authorize', async ctx => {
      await this.handleAuthorize(ctx, handlers);
    });

    router.post('/oauth/authorize', async ctx => {
      await this.handleAuthorize(ctx, handlers);
    });

    // Token endpoint
    router.post('/oauth/token', async ctx => {
      await this.handleToken(ctx, handlers);
    });

    // MCP endpoint (protected)
    router.post('/mcp', async ctx => {
      await this.handleMcp(ctx, handlers);
    });

    this.options.logger('Info', 'MCP server initialized successfully');

    return router;
  }

  private async handleAuthorize(ctx: any, handlers: McpHandlers): Promise<void> {
    ctx.set('Cache-Control', 'no-store');

    const params = ctx.method === 'POST' ? ctx.request.body : ctx.query;
    const authorizeParams: AuthorizeParams = {
      clientId: params.client_id,
      redirectUri: params.redirect_uri,
      codeChallenge: params.code_challenge,
      state: params.state,
      scope: params.scope,
    };

    const result = await handlers.handleAuthorize(authorizeParams);

    if (result.type === 'redirect') {
      ctx.redirect(result.url);
    } else {
      ctx.status = result.status;
      ctx.body = { error: result.error, error_description: result.errorDescription };
    }
  }

  private async handleToken(ctx: any, handlers: McpHandlers): Promise<void> {
    const body = ctx.request.body as Record<string, string>;
    const tokenParams: TokenParams = {
      grantType: body.grant_type,
      clientId: body.client_id,
      code: body.code,
      codeVerifier: body.code_verifier,
      redirectUri: body.redirect_uri,
      refreshToken: body.refresh_token,
    };

    const result = await handlers.handleToken(tokenParams);

    if (result.type === 'success') {
      ctx.body = result.tokens;
    } else {
      ctx.status = result.status;
      ctx.body = { error: result.error, error_description: result.errorDescription };
    }
  }

  private async handleMcp(ctx: any, handlers: McpHandlers): Promise<void> {
    // Extract bearer token
    const authHeader = ctx.get('Authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      ctx.status = 401;
      ctx.body = { error: 'unauthorized', error_description: 'Bearer token required' };

      return;
    }

    const token = authHeader.slice(7);

    try {
      // Verify token
      const authInfo = await handlers.verifyAccessToken(token);

      // Check scopes
      if (!authInfo.scopes.includes('mcp:read')) {
        ctx.status = 403;
        ctx.body = { error: 'insufficient_scope', error_description: 'mcp:read scope required' };

        return;
      }

      // Handle MCP request - this writes directly to the response for streaming
      const result = await handlers.handleMcpRequest(ctx.req, ctx.res, ctx.request.body);

      if (result.type === 'handled') {
        ctx.respond = false; // Let the transport handle the response
      } else {
        ctx.status = result.status;
        ctx.body = result.error;
      }
    } catch (error: any) {
      this.options.logger('Error', `MCP Error: ${error}`);
      ctx.status = error.message?.includes('token') ? 401 : 500;
      ctx.body = {
        jsonrpc: '2.0',
        error: { code: -32603, message: error.message || 'Internal error' },
        id: null,
      };
    }
  }

  private async buildRouterAndSendSchema(): Promise<{
    router: Router;
    mcpRouter?: Router;
  }> {
    const { isProduction, logger, typingsPath, typingsMaxDepth } = this.options;

    // It allows to rebuild the full customization stack with no code customizations
    this.nocodeCustomizer = new DataSourceCustomizer<S>({
      ignoreMissingSchemaElementErrors: this.options.ignoreMissingSchemaElementErrors || false,
      strategy: 'NoCode',
    });
    this.nocodeCustomizer.addDataSource(this.customizer.getFactory());
    this.nocodeCustomizer.use(this.customizationService.addCustomizations);

    const dataSource = await this.nocodeCustomizer.getDataSource(logger);
    const [routers] = await Promise.all([
      this.getRouter(dataSource),
      this.sendSchema(dataSource),
      !isProduction && typingsPath
        ? this.customizer.updateTypesOnFileSystem(typingsPath, typingsMaxDepth, logger)
        : Promise.resolve(),
    ]);

    return routers;
  }

  /**
   * Send the apimap to forest admin server
   */
  protected async sendSchema(dataSource: DataSource): Promise<void> {
    const { schemaPath, skipSchemaUpdate, isProduction, experimental } = this.options;

    // skipSchemaUpdate is mainly used in cloud version
    if (skipSchemaUpdate) {
      this.options.logger(
        'Warn',
        'Schema update was skipped (caused by options.skipSchemaUpdate=true)',
      );

      return;
    }

    // Either load the schema from the file system or build it
    let schema: Pick<ForestSchema, 'collections'>;

    const { meta } = SchemaGenerator.buildMetadata(this.customizationService.buildFeatures());

    // When using experimental no-code features even in production we need to build a new schema
    if (!experimental?.webhookCustomActions && isProduction) {
      try {
        schema = JSON.parse(await readFile(schemaPath, { encoding: 'utf-8' }));
      } catch (e) {
        throw new Error(`Can't load ${schemaPath}. Providing a schema is mandatory in production.`);
      }
    } else {
      schema = await this.schemaGenerator.buildSchema(dataSource);

      const pretty = stringify({ ...schema, meta }, { maxLength: 100 });
      await writeFile(schemaPath, pretty, { encoding: 'utf-8' });
    }

    // Send schema to forest servers
    await this.options.forestAdminClient.postSchema({ ...schema, meta });
  }
}
