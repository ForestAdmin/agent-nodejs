/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  BaseDataSource,
  ChartDefinition,
  Collection,
  DataSourceFactory,
  RenameCollectionDataSourceDecorator,
  TCollectionName,
  TSchema,
} from '@forestadmin/datasource-toolkit';
import { writeFile } from 'fs/promises';
import Koa from 'koa';
import Router from '@koa/router';
import http from 'http';

import { AgentServerOptions, BuilderOptions, MountOptions, RpcServerOptions } from '../types';
import { DataSourceOptions, HttpCallback } from './types';
import CollectionBuilder from './collection';
import DecoratorsStack from './decorators-stack';
import ForestAdminHttpDriver from '../expose/as-agent/forestadmin-http-driver';
import ForestAdminRpcServer from '../expose/as-datasource/rpc-server';
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
  private readonly options: BuilderOptions;
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
  constructor(options: BuilderOptions) {
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
      const dataSource = await factory(this.options.logger);
      const decorated = new RenameCollectionDataSourceDecorator(dataSource);

      for (const [oldName, newName] of Object.entries(options?.rename ?? {})) {
        decorated.renameCollection(oldName, newName);
      }

      for (const collection of decorated.collections) {
        this.compositeDataSource.addCollection(collection);
      }
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

  async startRpcServer(rpcOptions: RpcServerOptions): Promise<void> {
    await this.preStart(rpcOptions.mountPoint);

    const httpDriver = new ForestAdminRpcServer(this.stack.dataSource, rpcOptions);
    await this.postStart(await httpDriver.getRouter());
  }

  /**
   * Start the agent.
   */
  async startAgentServer(agentOptions: AgentServerOptions): Promise<void> {
    await this.preStart(agentOptions.mountPoint);

    const options = { ...this.options, ...agentOptions };
    const httpDriver = new ForestAdminHttpDriver(this.stack.dataSource, options as any);
    await httpDriver.sendSchema();

    await this.postStart(await httpDriver.getRouter());
  }

  async stop(): Promise<void> {
    for (const task of this.termination) await task(); // eslint-disable-line no-await-in-loop
  }

  private async preStart(options: MountOptions): Promise<void> {
    if (options.type === 'express') this.mountOnExpress(options.application);
    else if (options.type === 'fastify') this.mountOnFastify(options.application);
    else if (options.type === 'koa') this.mountOnKoa(options.application);
    else if (options.type === 'nestjs') this.mountOnNestJs(options.application);
    else if (options.type === 'standalone')
      this.mountOnStandaloneServer(options.port, options.host);
    else throw new Error('Invalid mount options');

    // Customize agent
    for (const task of this.customizations) await task(); // eslint-disable-line no-await-in-loop

    // Write typings file
    if (!this.options.isProduction && this.options.typingsPath) {
      const types = TypingGenerator.generateTypes(this.stack.action, this.options.typingsMaxDepth);
      await writeFile(this.options.typingsPath, types, { encoding: 'utf-8' });
    }
  }

  private async postStart(router: Router): Promise<void> {
    for (const task of this.mounts) await task(router); // eslint-disable-line no-await-in-loop
  }

  /**
   * Expose the agent on a given port and host
   * @param port port that should be used.
   * @param host host that should be used.
   */
  private mountOnStandaloneServer(port = 3351, host = 'localhost'): void {
    const server = http.createServer(this.getConnectCallback(true));
    server.listen(port, host);

    this.options.logger(
      'Info',
      `Successfully mounted on Standalone server (http://${host}:${port})`,
    );

    this.termination.push(async () => {
      server.close();
    });
  }

  /**
   * Mount the agent on an express app.
   * @param express instance of the express app or router.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mountOnExpress(express: any): void {
    express.use('/forest', this.getConnectCallback(false));
    this.options.logger('Info', `Successfully mounted on Express.js`);
  }

  /**
   * Mount the agent on a fastify app
   * @param fastify instance of the fastify app, or of a fastify context
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mountOnFastify(fastify: any): void {
    const callback = this.getConnectCallback(false);
    this.useCallbackOnFastify(fastify, callback);

    this.options.logger('Info', `Successfully mounted on Fastify`);
  }

  /**
   * Mount the agent on a koa app
   * @param koa instance of a koa app or a koa Router.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mountOnKoa(koa: any): void {
    const parentRouter = new Router({ prefix: '/forest' });
    koa.use(parentRouter.routes());
    this.options.logger('Info', `Successfully mounted on Koa`);

    this.mounts.push(async router => {
      parentRouter.use(router.routes());
    });
  }

  /**
   * Mount the agent on a NestJS app
   * @param nestJs instance of a NestJS application
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mountOnNestJs(nestJs: any): void {
    const adapter = nestJs.getHttpAdapter();
    const callback = this.getConnectCallback(false);

    if (adapter.constructor.name === 'ExpressAdapter') {
      nestJs.use('/forest', callback);
    } else {
      this.useCallbackOnFastify(nestJs, callback);
    }

    this.options.logger('Info', `Successfully mounted on NestJS`);
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
