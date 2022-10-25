import { DataSource } from '@forestadmin/datasource-toolkit';
import { TSchema } from '@forestadmin/datasource-customizer';
import Router from '@koa/router';
import bodyParser from 'koa-bodyparser';
import cors from '@koa/cors';

import { AgentOptions, AgentOptionsWithDefaults } from './types';
import ForestHttpApi from './utils/forest-http-api';
import MountableCustomizer from './mountable-customizer';
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
export default class Agent<S extends TSchema = TSchema> extends MountableCustomizer<S> {
  private options: AgentOptionsWithDefaults;

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
    const optionsWithDefaults = OptionsValidator.validate(OptionsValidator.withDefaults(options));
    super(options.prefix, options.logger);

    this.options = optionsWithDefaults;
  }

  /**
   * Start the agent.
   */
  override async start(): Promise<void> {
    const { logger, typingsPath, typingsMaxDepth } = this.options;

    const dataSource = await this.getDataSource(logger);
    const [router] = await Promise.all([
      this.getRouter(dataSource),
      this.sendSchema(dataSource),
      !this.options.isProduction && typingsPath
        ? this.updateTypesOnFileSystem(typingsPath, typingsMaxDepth)
        : Promise.resolve(),
    ]);

    return super.start(router);
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
