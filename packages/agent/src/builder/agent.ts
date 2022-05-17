import {
  BaseDataSource,
  ChartDefinition,
  Collection,
  DataSourceFactory,
  TCollectionName,
  TSchema,
} from '@forestadmin/datasource-toolkit';
import { writeFile } from 'fs/promises';
import Koa from 'koa';
import Router from '@koa/router';
import fastifyExpress from '@fastify/express';
import http from 'http';

import { AgentOptions } from '../types';
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
   */
  addDataSource(factory: DataSourceFactory): this {
    this.customizations.push(async () => {
      const datasource = await factory(this.options.logger);
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
    let server: http.Server;

    this.mounts.push(async router => {
      const koa = new Koa();
      const parentRouter = new Router({ prefix: '/forest' });
      parentRouter.use(router.routes());
      koa.use(parentRouter.routes());

      server = http.createServer(koa.callback());
      server.listen(port, host);
      this.options.logger(
        'Info',
        `Successfully mounted on Standalone server (http://${host}:${port})`,
      );
    });

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
    this.mounts.push(async router => {
      express.use('/forest', this.getConnectCallback(router, false));
      this.options.logger('Info', `Successfully mounted on Express.js`);
    });

    return this;
  }

  /**
   * Mount the agent on a fastify app
   * @param fastify instance of the fastify app, or of a fastify context
   */
  // eslint-disable-line @typescript-eslint/no-explicit-any
  mountOnFastify(fastify: any): this {
    this.mounts.push(async router => {
      const callback = this.getConnectCallback(router, false);
      await this.useCallbackOnFastify(fastify, callback);
      this.options.logger('Info', `Successfully mounted on Fastify`);
    });

    return this;
  }

  /**
   * Mount the agent on a koa app
   * @param koa instance of a koa app or a koa Router.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mountOnKoa(koa: any): this {
    this.mounts.push(async router => {
      koa.use(new Router({ prefix: '/forest' }).use(router.routes()).routes());
      this.options.logger('Info', `Successfully mounted on Koa`);
    });

    return this;
  }

  /**
   * Mount the agent on a NestJS app
   * @param nestJs instance of a NestJS application
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mountOnNestJs(nestJs: any): this {
    this.mounts.push(async router => {
      const adapter = nestJs.getHttpAdapter();
      const callback = this.getConnectCallback(router, false);

      if (adapter.constructor.name === 'ExpressAdapter') {
        nestJs.use('/forest', callback);
      } else {
        await this.useCallbackOnFastify(nestJs, callback);
      }

      this.options.logger('Info', `Successfully mounted on NestJS`);
    });

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
  private async useCallbackOnFastify(fastify: any, callback: HttpCallback): Promise<void> {
    try {
      // 'fastify 2' or 'middie' or 'fastify-express'
      fastify.use('/forest', callback);
    } catch (e) {
      // 'fastify 3'
      if (e.code === 'FST_ERR_MISSING_MIDDLEWARE') {
        await fastify.register(fastifyExpress);
        fastify.use('/forest', callback);
      } else {
        throw e;
      }
    }
  }

  private getConnectCallback(driverRouter: Router, nested: boolean): HttpCallback {
    let router = driverRouter;

    if (nested) {
      router = new Router({ prefix: '/forest' }).use(router.routes()).use(router.allowedMethods());
    }

    return new Koa().use(router.routes()).use(router.allowedMethods()).callback();
  }
}
