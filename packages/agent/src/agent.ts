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
import ActionCustomizationService from './services/model-customizations/action-customization';
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
  private actionCustomizationService: ActionCustomizationService<S>;

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
    this.actionCustomizationService = new ActionCustomizationService<S>(allOptions);
  }

  /**
   * Start the agent.
   */
  override async start(): Promise<void> {
    const { isProduction, logger, skipSchemaUpdate, typingsPath, typingsMaxDepth } = this.options;

    const dataSource = await this.customizer.getDataSource(logger);

    if (this.options.experimental?.webhookCustomActions) {
      await this.actionCustomizationService.addWebhookActions(this.customizer);
    }

    const [router] = await Promise.all([
      this.getRouter(dataSource),
      !skipSchemaUpdate ? this.sendSchema(dataSource) : Promise.resolve(),
      !isProduction && typingsPath
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
  addChart(name: string, definition: DataSourceChartDefinition<S>): this {
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
   * Load a plugin across all collections
   * @param plugin instance of the plugin
   * @param options options which need to be passed to the plugin
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
    router.use(bodyParser({ jsonLimit: '50mb' }));
    routes.forEach(route => route.setupRoutes(router));

    return router;
  }

  /**
   * Send the apimap to forest admin server
   */
  private async sendSchema(dataSource: DataSource): Promise<void> {
    const { schemaPath } = this.options;

    // Either load the schema from the file system or build it
    let schema: ForestSchema;

    if (this.options.isProduction) {
      try {
        schema = JSON.parse(await readFile(schemaPath, { encoding: 'utf-8' }));
      } catch (e) {
        throw new Error(`Can't load ${schemaPath}. Providing a schema is mandatory in production.`);
      }
    } else {
      schema = await SchemaGenerator.buildSchema(dataSource, this.buildSchemaFeatures());

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

  private buildSchemaFeatures(): Record<string, string> | null {
    if (this.options.experimental?.webhookCustomActions) {
      return {
        // Versions correspond to the version of the feature
        'webhook-custom-actions': ActionCustomizationService.VERSION,
      };
    }

    return null;
  }
}
