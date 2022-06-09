import {
  BaseDataSource,
  ChartDefinition,
  Collection,
  DataSourceDecorator,
  DataSourceFactory,
  RenameCollectionCollectionDecorator,
  TCollectionName,
  TSchema,
} from '@forestadmin/datasource-toolkit';
import { writeFile } from 'fs/promises';
import Koa from 'koa';
import Router from '@koa/router';
import http from 'http';

import { AgentOptions, DataSourceOptions } from '../types';
import { HttpCallback } from './types';
import CollectionBuilder from './collection';
import DecoratorsStack from './decorators-stack';
import ForestAdminHttpDriver from '../agent/forestadmin-http-driver';
import OptionsValidator from './utils/options-validator';
import TypingGenerator from './utils/typing-generator';

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
export default class AgentBuilder<S extends TSchema = TSchema> {
  private readonly compositeDataSource: BaseDataSource<Collection>;
  private readonly stack: DecoratorsStack;
  private readonly options: AgentOptions;
  private customizations: (() => Promise<void>)[] = [];
  private mounts: ((router: Router) => Promise<void>)[] = [];
  private termination: (() => Promise<void>)[] = [];

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
    this.options = OptionsValidator.withDefaults(options);
    this.compositeDataSource = new BaseDataSource<Collection>();
    this.stack = new DecoratorsStack(this.compositeDataSource);
  }

  /**
   * Add a datasource
   * @param factory the datasource to add
   * @param options the options
   */
  addDataSource(factory: DataSourceFactory, options?: DataSourceOptions): this {
    this.customizations.push(async () => {
      let dataSource = await factory(this.options.logger);

      const names = dataSource.collections.map(({ name }) => name);
      const oldNames = Object.keys(options?.rename ?? {});
      const notFoundName = oldNames.find(oldName => !names.includes(oldName));

      if (notFoundName) {
        throw new Error(`The given collection name "${notFoundName}" does not exist`);
      }

      dataSource = new DataSourceDecorator(dataSource, RenameCollectionCollectionDecorator);
      dataSource.collections.forEach(collection => {
        const option = options?.rename[collection.name];

        if (option) {
          (collection as RenameCollectionCollectionDecorator).rename(option.newName);
        }

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
  addChart(name: string, definition: ChartDefinition<S>): this {
    this.customizations.push(async () => {
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
  customizeCollection<N extends TCollectionName<S>>(
    name: N,
    handle: (collection: CollectionBuilder<S, N>) => unknown,
  ): this {
    this.customizations.push(async () => {
      if (this.stack.dataSource.getCollection(name)) {
        handle(new CollectionBuilder<S, N>(this.stack, name));
      }
    });

    return this;
  }

  /**
   * Expose the agent on a given port and host
   * @param port port that should be used.
   * @param host host that should be used.
   */
  mountOnStandaloneServer(port = 3351, host = 'localhost'): this {
    const server = http.createServer(this.getConnectCallback(true));
    server.listen(port, host);

    this.options.logger(
      'Info',
      `Successfully mounted on Standalone server (http://${host}:${port})`,
    );

    this.termination.push(async () => {
      server.close();
    });

    return this;
  }

  /**
   * Mount the agent on an express app.
   * @param express instance of the express app or router.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mountOnExpress(express: any): this {
    express.use('/forest', this.getConnectCallback(false));
    this.options.logger('Info', `Successfully mounted on Express.js`);

    return this;
  }

  /**
   * Mount the agent on a fastify app
   * @param fastify instance of the fastify app, or of a fastify context
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mountOnFastify(fastify: any): this {
    const callback = this.getConnectCallback(false);
    this.useCallbackOnFastify(fastify, callback);

    this.options.logger('Info', `Successfully mounted on Fastify`);

    return this;
  }

  /**
   * Mount the agent on a koa app
   * @param koa instance of a koa app or a koa Router.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mountOnKoa(koa: any): this {
    const parentRouter = new Router({ prefix: '/forest' });
    koa.use(parentRouter.routes());
    this.options.logger('Info', `Successfully mounted on Koa`);

    this.mounts.push(async router => {
      parentRouter.use(router.routes());
    });

    return this;
  }

  /**
   * Mount the agent on a NestJS app
   * @param nestJs instance of a NestJS application
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mountOnNestJs(nestJs: any): this {
    const adapter = nestJs.getHttpAdapter();
    const callback = this.getConnectCallback(false);

    if (adapter.constructor.name === 'ExpressAdapter') {
      nestJs.use('/forest', callback);
    } else {
      this.useCallbackOnFastify(nestJs, callback);
    }

    this.options.logger('Info', `Successfully mounted on NestJS`);

    return this;
  }

  /**
   * Start the agent.
   */
  async start(): Promise<void> {
    // Customize agent
    for (const task of this.customizations) await task(); // eslint-disable-line no-await-in-loop

    // Check that options are valid
    const options = OptionsValidator.validate(this.options);

    // Write typings file
    if (!options.isProduction && options.typingsPath) {
      const types = TypingGenerator.generateTypes(this.stack.action, options.typingsMaxDepth);
      await writeFile(options.typingsPath, types, { encoding: 'utf-8' });
    }

    const httpDriver = new ForestAdminHttpDriver(this.stack.dataSource, options);
    await httpDriver.sendSchema();

    const router = await httpDriver.getRouter();
    for (const task of this.mounts) await task(router); // eslint-disable-line no-await-in-loop
  }

  async stop(): Promise<void> {
    for (const task of this.termination) await task(); // eslint-disable-line no-await-in-loop
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private useCallbackOnFastify(fastify: any, callback: HttpCallback): void {
    try {
      // 'fastify 2' or 'middie' or 'fastify-express'
      fastify.use('/forest', callback);
    } catch (e) {
      // 'fastify 3'
      if (e.code === 'FST_ERR_MISSING_MIDDLEWARE') {
        fastify
          .register(import('@fastify/express'))
          .then(() => {
            fastify.use('/forest', callback);
          })
          .catch(err => {
            this.options.logger('Error', err.message);
          });
      } else {
        throw e;
      }
    }
  }

  private getConnectCallback(nested: boolean): HttpCallback {
    let handler = null;

    this.mounts.push(async driverRouter => {
      let router = driverRouter;

      if (nested) {
        router = new Router({ prefix: '/forest' }).use(router.routes());
      }

      handler = new Koa().use(router.routes()).callback();
    });

    return (req, res) => {
      if (handler) {
        handler(req, res);
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Agent is not started' }));
      }
    };
  }
}
