import {
  ActionCollectionDecorator,
  BaseDataSource,
  Collection,
  ComputedCollectionDecorator,
  DataSource,
  DataSourceDecorator,
  OperatorsEmulateCollectionDecorator,
  OperatorsReplaceCollectionDecorator,
  PublicationCollectionDecorator,
  RenameCollectionDecorator,
  SearchCollectionDecorator,
  SegmentCollectionDecorator,
  SortEmulateCollectionDecorator,
} from '@forestadmin/datasource-toolkit';

import { AgentOptions } from '../types';
import CollectionBuilder from './collection';
import ForestAdminHttpDriver, { HttpCallback } from '../agent/forestadmin-http-driver';

/**
 * Allow to create a new Forest Admin agent from scratch.
 * Builds the application by composing and configuring all the collection decorators.
 *
 * @example
 * Minimal code to add a datasource
 * ```
 * new AgentBuilder(options)
 *  .addDatasource(new SomeDatasource())
 *  .start();
 * ```
 */
export default class AgentBuilder {
  compositeDatasource: BaseDataSource<Collection>;

  operatorEmulate: DataSourceDecorator<OperatorsEmulateCollectionDecorator>;

  operatorReplace: DataSourceDecorator<OperatorsReplaceCollectionDecorator>;

  computed: DataSourceDecorator<ComputedCollectionDecorator>;

  segment: DataSourceDecorator<SegmentCollectionDecorator>;

  rename: DataSourceDecorator<RenameCollectionDecorator>;

  publication: DataSourceDecorator<PublicationCollectionDecorator>;

  sortEmulate: DataSourceDecorator<SortEmulateCollectionDecorator>;

  search: DataSourceDecorator<SearchCollectionDecorator>;

  action: DataSourceDecorator<ActionCollectionDecorator>;

  forestAdminHttpDriver: ForestAdminHttpDriver;

  /**
   * Native nodejs HttpCallback object
   * @example
   * ```
   * import http from 'http';
   * ...
   * const server = http.createServer(agent.httpCallback);
   * ```
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
   *  logger: (level, data) => console.error(OptionsUtils.loggerPrefix[level], data),
   *  prefix: '/forest',
   *  schemaPath: '.forestadmin-schema.json',
   *  permissionsCacheDurationInSeconds: 15 * 60,
   * ```
   * @param {AgentOptions} options options
   * @example
   * ```
   * new AgentBuilder(options)
   *  .addDatasource(new Datasource())
   *  .decorate()
   *  .start();
   * ```
   */
  constructor(options: AgentOptions) {
    this.compositeDatasource = new BaseDataSource<Collection>();

    this.computed = new DataSourceDecorator(this.compositeDatasource, ComputedCollectionDecorator);
    this.operatorEmulate = new DataSourceDecorator(
      this.computed,
      OperatorsEmulateCollectionDecorator,
    );
    this.operatorReplace = new DataSourceDecorator(
      this.operatorEmulate,
      OperatorsReplaceCollectionDecorator,
    );
    this.sortEmulate = new DataSourceDecorator(
      this.operatorReplace,
      SortEmulateCollectionDecorator,
    );
    this.segment = new DataSourceDecorator(this.sortEmulate, SegmentCollectionDecorator);
    this.rename = new DataSourceDecorator(this.segment, RenameCollectionDecorator);
    this.publication = new DataSourceDecorator(this.rename, PublicationCollectionDecorator);
    this.search = new DataSourceDecorator(this.publication, SearchCollectionDecorator);
    this.action = new DataSourceDecorator(this.search, ActionCollectionDecorator);

    this.forestAdminHttpDriver = new ForestAdminHttpDriver(this.action, options);
  }

  /**
   * Add a datasource
   * @param {DataSource} datasource the datasource to add
   */
  addDatasource(datasource: DataSource): this {
    datasource.collections.forEach(collection => {
      this.compositeDatasource.addCollection(collection);
    });

    return this;
  }

  /**
   * Allow to interact with a decorated collection
   * @param {string} name the name of the collection to manipulate
   * @param {(collection: CollectionBuilder) => unknown} handle a function that provide a
   *   collection builder on the given collection name
   * @example
   * ```
   * .collection('books', books => books.renameField('xx', 'yy'))
   * ```
   */
  collection(name: string, handle: (collection: CollectionBuilder) => unknown): this {
    if (this.action.getCollection(name)) {
      handle(new CollectionBuilder(this, name));
    }

    return this;
  }

  /**
   * Start the agent.
   */
  async start(): Promise<void> {
    return this.forestAdminHttpDriver.start();
  }

  /**
   * Stop the agent gracefully.
   */
  async stop(): Promise<void> {
    return this.forestAdminHttpDriver.stop();
  }
}
