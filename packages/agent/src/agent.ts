/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ChartDefinition,
  CollectionCustomizer,
  DataSourceCustomizer,
  DataSourceOptions,
  Plugin,
  TCollectionName,
  TSchema,
} from '@forestadmin/datasource-customizer';
import { DataSource, DataSourceFactory } from '@forestadmin/datasource-toolkit';
import Router from '@koa/router';
import bodyParser from 'koa-bodyparser';
import cors from '@koa/cors';

import { AgentOptions, AgentOptionsWithDefaults } from './types';
import ForestHttpApi from './utils/forest-http-api';
import FrameworkMounter from './framework-mounter';
import OptionsValidator from './utils/options-validator';
import SchemaEmitter from './utils/forest-schema/emitter';
import makeRoutes from './routes';
import makeServices from './services';

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
  }

  /**
   * Start the agent.
   */
  override async start(): Promise<void> {
    const { logger, typingsPath, typingsMaxDepth } = this.options;

    const dataSource = await this.customizer.getDataSource(logger);
    const [router] = await Promise.all([
      this.getRouter(dataSource),
      this.sendSchema(dataSource),
      !this.options.isProduction && typingsPath
        ? this.customizer.updateTypesOnFileSystem(typingsPath, typingsMaxDepth)
        : Promise.resolve(),
    ]);

    return super.start(router);
  }

  /**
   * Add a datasource
   * @param factory the datasource to add
   * @param options the options
   */
  addDataSource(factory: DataSourceFactory, options?: DataSourceOptions): this {
    this.customizer.addDataSource(factory, options);

    return this;
  }

  /**
   * Create a new API chart
   * @param name name of the chart
   * @param definition definition of the chart
   * @example
   * .addChart('numCustomers', {
   *   type: 'Value',
   *   render: (context, resultBuilder) => {
   *     return resultBuilder.value(123);
   *   }
   * })
   */
  addChart(name: string, definition: ChartDefinition<S>): this {
    this.customizer.addChart(name, definition);

    return this;
  }

  /**
   * Allow to interact with a decorated collection
   * @param name the name of the collection to manipulate
   * @param handle a function that provide a
   *   collection builder on the given collection name
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
   * Load a plugin, agent-wide
   * @param plugin instance of the plugin
   * @param options options which need to be passed to the plugin
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
    router.use(bodyParser({ jsonLimit: '50mb' }));
    routes.forEach(route => route.setupRoutes(router));

    return router;
  }

  /**
   * Send the apimap to forest admin server
   */
  private async sendSchema(dataSource: DataSource): Promise<void> {
    const schema = await SchemaEmitter.getSerializedSchema(this.options, dataSource);
    const schemaIsKnown = await ForestHttpApi.hasSchema(this.options, schema.meta.schemaFileHash);

    if (!schemaIsKnown) {
      this.options.logger('Info', 'Schema was updated, sending new version');
      await ForestHttpApi.uploadSchema(this.options, schema);
    } else {
      this.options.logger('Info', 'Schema was not updated since last run');
    }
  }
}
