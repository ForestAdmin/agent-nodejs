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
import cors from '@koa/cors';
import Router from '@koa/router';
import { readFile, writeFile } from 'fs/promises';
import stringify from 'json-stringify-pretty-compact';
import bodyParser from 'koa-bodyparser';

import FrameworkMounter from './framework-mounter';
import makeRoutes from './routes';
import makeServices from './services';
import CustomizationService from './services/model-customizations/customization';
import { AgentOptions, AgentOptionsWithDefaults } from './types';
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
  private options: AgentOptionsWithDefaults;
  private customizer: DataSourceCustomizer<S>;
  private nocodeCustomizer: DataSourceCustomizer<S>;
  private customizationService: CustomizationService;

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
    this.customizer = new DataSourceCustomizer<S>();
    this.customizationService = new CustomizationService(allOptions);
  }

  /**
   * Start the agent.
   */
  async start(): Promise<void> {
    const router = await this.buildRouterAndSendSchema();

    await this.options.forestAdminClient.subscribeToServerEvents();
    this.options.forestAdminClient.onRefreshCustomizations(this.restart.bind(this));

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
  private async restart(): Promise<void> {
    // We force sending schema when restarting
    const updatedRouter = await this.buildRouterAndSendSchema();

    await this.remount(updatedRouter);
  }

  /**
   * Add a datasource
   * @param factory the datasource to add
   * @param options the options
   * @see {@link https://docs.forestadmin.com/developer-guide-agents-nodejs/data-sources/connection Documentation Link}
   */
  addDataSource(factory: DataSourceFactory, options?: DataSourceOptions): this {
    this.customizer.addDataSource(factory, options);

    return this;
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
   * Create an http handler which can respond to all queries which are expected from an agent.
   */
  private async getRouter(dataSource: DataSource): Promise<Router> {
    // Bootstrap app
    const services = makeServices(this.options);
    const routes = makeRoutes(dataSource, this.options, services);
    await Promise.all(routes.map(route => route.bootstrap()));

    // Build router
    const router = new Router();
    router.all('(.*)', cors({ credentials: true, maxAge: 24 * 3600, privateNetworkAccess: true }));
    router.use(bodyParser({ jsonLimit: this.options.maxBodySize }));
    routes.forEach(route => route.setupRoutes(router));

    return router;
  }

  private async buildRouterAndSendSchema(): Promise<Router> {
    const { isProduction, logger, typingsPath, typingsMaxDepth } = this.options;

    // It allows to rebuild the full customization stack with no code customizations
    this.nocodeCustomizer = new DataSourceCustomizer<S>();
    this.nocodeCustomizer.addDataSource(this.customizer.getFactory());
    this.nocodeCustomizer.use(this.customizationService.addCustomizations);

    const dataSource = await this.nocodeCustomizer.getDataSource(logger);
    const [router] = await Promise.all([
      this.getRouter(dataSource),
      this.sendSchema(dataSource),
      !isProduction && typingsPath
        ? this.customizer.updateTypesOnFileSystem(typingsPath, typingsMaxDepth, logger)
        : Promise.resolve(),
    ]);

    return router;
  }

  /**
   * Send the apimap to forest admin server
   */
  private async sendSchema(dataSource: DataSource): Promise<void> {
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
    let schema: ForestSchema;

    // When using experimental no-code features even in production we need to build a new schema
    if (!experimental?.webhookCustomActions && isProduction) {
      try {
        schema = JSON.parse(await readFile(schemaPath, { encoding: 'utf-8' }));
      } catch (e) {
        throw new Error(`Can't load ${schemaPath}. Providing a schema is mandatory in production.`);
      }
    } else {
      schema = await SchemaGenerator.buildSchema(
        dataSource,
        this.customizationService.buildFeatures(),
      );

      const pretty = stringify(schema, { maxLength: 100 });
      await writeFile(schemaPath, pretty, { encoding: 'utf-8' });
    }

    // Send schema to forest servers
    const updated = await this.options.forestAdminClient.postSchema(schema);
    const message = updated
      ? 'Schema was updated, sending new version'
      : 'Schema was not updated since last run';

    this.options.logger('Info', message);
  }
}
