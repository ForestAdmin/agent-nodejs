import {
  ActionCollectionDecorator,
  BaseDataSource,
  Collection,
  ComputedCollectionDecorator,
  DataSource,
  DataSourceDecorator,
  JointureCollectionDecorator,
  OperatorsEmulateCollectionDecorator,
  OperatorsReplaceCollectionDecorator,
  PublicationCollectionDecorator,
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

  earlyComputed: DataSourceDecorator<ComputedCollectionDecorator>;
  earlyOpEmulate: DataSourceDecorator<OperatorsEmulateCollectionDecorator>;
  earlyOpReplace: DataSourceDecorator<OperatorsReplaceCollectionDecorator>;

  jointure: DataSourceDecorator<JointureCollectionDecorator>;

  lateComputed: DataSourceDecorator<ComputedCollectionDecorator>;
  lateOpEmulate: DataSourceDecorator<OperatorsEmulateCollectionDecorator>;
  lateOpReplace: DataSourceDecorator<OperatorsReplaceCollectionDecorator>;

  sortEmulate: DataSourceDecorator<SortEmulateCollectionDecorator>;

  segment: DataSourceDecorator<SegmentCollectionDecorator>;
  action: DataSourceDecorator<ActionCollectionDecorator>;
  search: DataSourceDecorator<SearchCollectionDecorator>;

  rename: DataSourceDecorator<RenameCollectionDecorator>;
  publication: DataSourceDecorator<PublicationCollectionDecorator>;

  write: DataSourceDecorator<WriteCollectionDecorator>;

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
   *  .start();
   * ```
   */
  constructor(options: AgentOptions) {
    let last: DataSource;

    /* eslint-disable no-multi-assign */
    last = this.compositeDatasource = new BaseDataSource<Collection>();

    // Step 1: Computed-Jointure-Computed sandwich (needed because some emulated jointures depend
    // on computed fields, and some computed fields depend on jointure...)
    // Note that replacement goes before emulation, as replacements may use emulated operators.
    last = this.earlyComputed = new DataSourceDecorator(last, ComputedCollectionDecorator);
    last = this.earlyOpEmulate = new DataSourceDecorator(last, OperatorsEmulateCollectionDecorator);
    last = this.earlyOpReplace = new DataSourceDecorator(last, OperatorsReplaceCollectionDecorator);
    last = this.jointure = new DataSourceDecorator(last, JointureCollectionDecorator);
    last = this.lateComputed = new DataSourceDecorator(last, ComputedCollectionDecorator);
    last = this.lateOpEmulate = new DataSourceDecorator(last, OperatorsEmulateCollectionDecorator);
    last = this.lateOpReplace = new DataSourceDecorator(last, OperatorsReplaceCollectionDecorator);

    // Step 2: Those four can be in any order, as long as they are after field manipulation.
    last = this.search = new DataSourceDecorator(last, SearchCollectionDecorator);
    last = this.segment = new DataSourceDecorator(last, SegmentCollectionDecorator);
    last = this.sortEmulate = new DataSourceDecorator(last, SortEmulateCollectionDecorator);
    last = this.write = new DataSourceDecorator(last, WriteCollectionDecorator);

    // Step 3: Actions have access to all emulation
    last = this.action = new DataSourceDecorator(last, ActionCollectionDecorator);

    // Step 4: Publication goes at the end (because we don't want to prohibit customer from using
    // fields he don't want to publish to be used in his code).
    last = this.publication = new DataSourceDecorator(last, PublicationCollectionDecorator);

    // Step 5: We want customers to always use the same nomenclature when they refer to fields
    // so renaming must be either the very first or very last.
    last = this.rename = new DataSourceDecorator(last, RenameCollectionDecorator);

    /* eslint-enable no-multi-assign */

    this.forestAdminHttpDriver = new ForestAdminHttpDriver(last, options);
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
   * .customizeCollection('books', books => books.renameField('xx', 'yy'))
   * ```
   */
  customizeCollection(name: string, handle: (collection: CollectionBuilder) => unknown): this {
    if (this.publication.getCollection(name)) {
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
