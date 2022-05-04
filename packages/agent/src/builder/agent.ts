import { BaseDataSource, Collection, DataSourceFactory } from '@forestadmin/datasource-toolkit';

import { AgentOptions } from '../types';
import CollectionBuilder from './collection';
import DecoratorsStack from './decorators-stack';
import ForestAdminHttpDriver, { HttpCallback } from '../agent/forestadmin-http-driver';

/**
 * Allow to create a new Forest Admin agent from scratch.
 * Builds the application by composing and configuring all the collection decorators.
 *
 * Minimal code to add a datasource
 * @example
 * new AgentBuilder(options)
 *  .addDatasource(new SomeDatasource())
 *  .start();
 */
export default class AgentBuilder {
  private readonly forestAdminHttpDriver: ForestAdminHttpDriver;
  private readonly compositeDatasource: BaseDataSource<Collection>;
  private readonly stack: DecoratorsStack;
  private tasks: (() => Promise<void>)[] = [];

  /**
   * Native nodejs HttpCallback object
   * @example
   * import http from 'http';
   * ...
   * const server = http.createServer(agent.httpCallback);
   */
  get httpCallback(): HttpCallback {
    return this.forestAdminHttpDriver.handler;
  }

  /**
   * Create a new Agent Builder.
   * If any options are missing, the default will be applied:
   * ```
   *  clientId: null,
   *  forestServerUrl: 'https://api.forestadmin.com',
   *  logger: (level, data) => console.error(level, data),
   *  prefix: '/forest',
   *  schemaPath: '.forestadmin-schema.json',
   *  permissionsCacheDurationInSeconds: 15 * 60,
   * ```
   * @param options options
   * @example
   * new AgentBuilder(options)
   *  .addDatasource(new Datasource())
   *  .start();
   */
  constructor(options: AgentOptions) {
    this.compositeDatasource = new BaseDataSource<Collection>();
    this.stack = new DecoratorsStack(this.compositeDatasource);

    this.forestAdminHttpDriver = new ForestAdminHttpDriver(this.stack.dataSource, options);
  }

  /**
   * Add a datasource
   * @param factory the datasource to add
   */
  addDatasource(factory: DataSourceFactory): this {
    this.tasks.push(async () => {
      const datasource = await factory(this.forestAdminHttpDriver.options.logger);
      datasource.collections.forEach(collection => {
        this.compositeDatasource.addCollection(collection);
      });
    });

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
  customizeCollection(name: string, handle: (collection: CollectionBuilder) => unknown): this {
    this.tasks.push(async () => {
      if (this.stack.dataSource.getCollection(name)) {
        handle(new CollectionBuilder(this.stack, name));
      }
    });

    return this;
  }

  /**
   * Start the agent.
   */
  async start(): Promise<void> {
    for (const task of this.tasks) {
      // eslint-disable-next-line no-await-in-loop
      await task();
    }

    await this.forestAdminHttpDriver.start();
  }

  /**
   * Stop the agent gracefully.
   */
  async stop(): Promise<void> {
    return this.forestAdminHttpDriver.stop();
  }
}
