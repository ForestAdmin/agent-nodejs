import {
  ActionCollectionDecorator,
  BaseDataSource,
  Collection,
  ComputedCollectionDecorator,
  DataSource,
  DataSourceDecorator,
  DataSourceFactory,
  OperatorsEmulateCollectionDecorator,
  OperatorsReplaceCollectionDecorator,
  PublicationCollectionDecorator,
  RelationCollectionDecorator,
  RenameCollectionDecorator,
  SearchCollectionDecorator,
  SegmentCollectionDecorator,
  SortEmulateCollectionDecorator,
  WriteCollectionDecorator,
} from '@forestadmin/datasource-toolkit';

import { AgentOptions } from '../types';
import CollectionBuilder from './collection';
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
  // App
  forestAdminHttpDriver: ForestAdminHttpDriver;

  // Base datasource
  compositeDatasource: BaseDataSource<Collection>;

  // Decorators
  action: DataSourceDecorator<ActionCollectionDecorator>;
  earlyComputed: DataSourceDecorator<ComputedCollectionDecorator>;
  earlyOpEmulate: DataSourceDecorator<OperatorsEmulateCollectionDecorator>;
  earlyOpReplace: DataSourceDecorator<OperatorsReplaceCollectionDecorator>;
  relation: DataSourceDecorator<RelationCollectionDecorator>;
  lateComputed: DataSourceDecorator<ComputedCollectionDecorator>;
  lateOpEmulate: DataSourceDecorator<OperatorsEmulateCollectionDecorator>;
  lateOpReplace: DataSourceDecorator<OperatorsReplaceCollectionDecorator>;
  publication: DataSourceDecorator<PublicationCollectionDecorator>;
  rename: DataSourceDecorator<RenameCollectionDecorator>;
  search: DataSourceDecorator<SearchCollectionDecorator>;
  segment: DataSourceDecorator<SegmentCollectionDecorator>;
  sortEmulate: DataSourceDecorator<SortEmulateCollectionDecorator>;
  write: DataSourceDecorator<WriteCollectionDecorator>;

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
   * @param {AgentOptions} options options
   * @example
   * new AgentBuilder(options)
   *  .addDatasource(new Datasource())
   *  .start();
   */
  constructor(options: AgentOptions) {
    let last: DataSource;

    /* eslint-disable no-multi-assign */
    last = this.compositeDatasource = new BaseDataSource<Collection>();

    // Step 1: Computed-Relation-Computed sandwich (needed because some emulated relations depend
    // on computed fields, and some computed fields depend on relation...)
    // Note that replacement goes before emulation, as replacements may use emulated operators.
    last = this.earlyComputed = new DataSourceDecorator(last, ComputedCollectionDecorator);
    last = this.earlyOpEmulate = new DataSourceDecorator(last, OperatorsEmulateCollectionDecorator);
    last = this.earlyOpReplace = new DataSourceDecorator(last, OperatorsReplaceCollectionDecorator);
    last = this.relation = new DataSourceDecorator(last, RelationCollectionDecorator);
    last = this.lateComputed = new DataSourceDecorator(last, ComputedCollectionDecorator);
    last = this.lateOpEmulate = new DataSourceDecorator(last, OperatorsEmulateCollectionDecorator);
    last = this.lateOpReplace = new DataSourceDecorator(last, OperatorsReplaceCollectionDecorator);

    // Step 2: Those four need access to all fields. They can be loaded in any order.
    last = this.search = new DataSourceDecorator(last, SearchCollectionDecorator);
    last = this.segment = new DataSourceDecorator(last, SegmentCollectionDecorator);
    last = this.sortEmulate = new DataSourceDecorator(last, SortEmulateCollectionDecorator);
    last = this.write = new DataSourceDecorator(last, WriteCollectionDecorator);

    // Step 3: Access to all fields AND emulated capabilities
    last = this.action = new DataSourceDecorator(last, ActionCollectionDecorator);

    // Step 4: Renaming must be either the very first or very last so that naming in customer code
    // is consistent.
    last = this.publication = new DataSourceDecorator(last, PublicationCollectionDecorator);
    last = this.rename = new DataSourceDecorator(last, RenameCollectionDecorator);

    /* eslint-enable no-multi-assign */

    this.forestAdminHttpDriver = new ForestAdminHttpDriver(last, options);
  }

  /**
   * Add a datasource
   * @param {DataSourceFactory} factory the datasource to add
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
   * @param {string} name the name of the collection to manipulate
   * @param {(collection: CollectionBuilder) => unknown} handle a function that provide a
   *   collection builder on the given collection name
   * @example
   * .customizeCollection('books', books => books.renameField('xx', 'yy'))
   */
  customizeCollection(name: string, handle: (collection: CollectionBuilder) => unknown): this {
    this.tasks.push(async () => {
      if (this.publication.getCollection(name)) {
        handle(new CollectionBuilder(this, name));
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

    return this.forestAdminHttpDriver.start();
  }

  /**
   * Stop the agent gracefully.
   */
  async stop(): Promise<void> {
    return this.forestAdminHttpDriver.stop();
  }
}
