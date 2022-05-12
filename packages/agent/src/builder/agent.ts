import {
  BaseDataSource,
  ChartDefinition,
  Collection,
  DataSourceFactory,
} from '@forestadmin/datasource-toolkit';

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
 *  .addDataSource(new SomeDataSource())
 *  .start();
 */
export default class AgentBuilder {
  private readonly forestAdminHttpDriver: ForestAdminHttpDriver;
  private readonly compositeDataSource: BaseDataSource<Collection>;
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
   *  .addDataSource(new DataSource())
   *  .start();
   */
  constructor(options: AgentOptions) {
    this.compositeDataSource = new BaseDataSource<Collection>();
    this.stack = new DecoratorsStack(this.compositeDataSource);

    this.forestAdminHttpDriver = new ForestAdminHttpDriver(this.stack.dataSource, options);
  }

  /**
   * Add a datasource
   * @param factory the datasource to add
   */
  addDataSource(factory: DataSourceFactory): this {
    this.tasks.push(async () => {
      const datasource = await factory(this.forestAdminHttpDriver.options.logger);
      datasource.collections.forEach(collection => {
        this.compositeDataSource.addCollection(collection);
      });
    });

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
  addChart(name: string, definition: ChartDefinition): this {
    this.tasks.push(async () => {
      this.stack.chart.addChart(name, definition);
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
