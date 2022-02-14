/* eslint-disable max-classes-per-file */
/* eslint-disable max-len */

import {
  BaseDataSource,
  Collection,
  ComputedCollectionDecorator,
  DataSource,
  DataSourceDecorator,
  Operator,
  OperatorsEmulateCollectionDecorator,
  OperatorsReplaceCollectionDecorator,
  PublicationCollectionDecorator,
  RenameCollectionDecorator,
  SearchCollectionDecorator,
  SegmentCollectionDecorator,
  Sort,
  SortEmulateCollectionDecorator,
} from '@forestadmin/datasource-toolkit';
import { ComputedDefinition } from '@forestadmin/datasource-toolkit/dist/src/decorators/computed/types';
import { OperatorReplacer } from '@forestadmin/datasource-toolkit/dist/src/decorators/operators-emulate/types';
import { ForestAdminHttpDriverOptions } from '.';
import ForestAdminHttpDriver, { HttpCallback } from './forestadmin-http-driver';

export class CollectionBuilder {
  agentBuilder: AgentBuilder;

  name: string;

  constructor(agentBuilder: AgentBuilder, name: string) {
    this.agentBuilder = agentBuilder;
    this.name = name;
  }

  renameField(oldName: string, newName: string): this {
    this.agentBuilder.rename.getCollection(this.name).renameField(oldName, newName);

    return this;
  }

  publishFields(names: string): this {
    const collection = this.agentBuilder.publication.getCollection(this.name);
    for (const name of names) collection.changeFieldVisibility(name, true);

    return this;
  }

  unpublishFields(names: string[]): this {
    const collection = this.agentBuilder.publication.getCollection(this.name);
    for (const name of names) collection.changeFieldVisibility(name, false);

    return this;
  }

  registerComputed(name: string, definition: ComputedDefinition): this {
    this.agentBuilder.computed.getCollection(this.name).registerComputed(name, definition);

    return this;
  }

  emulateSort(name: string): this {
    this.agentBuilder.sortEmulate.getCollection(this.name).emulateSort(name);

    return this;
  }

  implementSort(name: string, equivalentSort: Sort): this {
    this.agentBuilder.sortEmulate.getCollection(this.name).implementSort(name, equivalentSort);

    return this;
  }

  emulateOperator(name: string, operator: Operator): this {
    this.agentBuilder.operatorEmulate.getCollection(this.name).emulateOperator(name, operator);

    return this;
  }

  emulateStringOperators(name: string): this {
    this.emulateOperator(name, Operator.Equal);
    this.emulateOperator(name, Operator.NotEqual);
    this.emulateOperator(name, Operator.Present);
    this.emulateOperator(name, Operator.Blank);
    this.emulateOperator(name, Operator.In);
    this.emulateOperator(name, Operator.StartsWith);
    this.emulateOperator(name, Operator.EndsWith);
    this.emulateOperator(name, Operator.Contains);
    this.emulateOperator(name, Operator.NotContains);

    return this;
  }

  implementOperator(name: string, operator: Operator, replacer: OperatorReplacer): this {
    this.agentBuilder.operatorEmulate
      .getCollection(this.name)
      .implementOperator(name, operator, replacer);

    return this;
  }
}

export default class AgentBuilder {
  operatorEmulate: DataSourceDecorator<OperatorsEmulateCollectionDecorator>;

  operatorReplace: DataSourceDecorator<OperatorsReplaceCollectionDecorator>;

  computed: DataSourceDecorator<ComputedCollectionDecorator>;

  compositeDatasource: BaseDataSource<Collection>;

  segment: DataSourceDecorator<SegmentCollectionDecorator>;

  rename: DataSourceDecorator<RenameCollectionDecorator>;

  publication: DataSourceDecorator<PublicationCollectionDecorator>;

  sortEmulate: DataSourceDecorator<SortEmulateCollectionDecorator>;

  search: DataSourceDecorator<SearchCollectionDecorator>;

  forestAdminHttpDriver: ForestAdminHttpDriver;
  driverOptions: ForestAdminHttpDriverOptions;
  get httpCallback(): HttpCallback {
    return this.forestAdminHttpDriver.handler;
  }

  private validateDriverOptions(driverOptions: Partial<ForestAdminHttpDriverOptions>) {
    if (!driverOptions.authSecret) throw new Error('Missing authSecret');
    if (!driverOptions.envSecret) throw new Error('Missing envSecret');
    if (!driverOptions.agentUrl) throw new Error('Missing agentUrl');
  }

  constructor(forestAdminHttpDriverOptions: Partial<ForestAdminHttpDriverOptions>) {
    this.compositeDatasource = new BaseDataSource<Collection>();

    this.validateDriverOptions(forestAdminHttpDriverOptions);

    this.driverOptions = {
      // eslint-disable-next-line no-console
      logger: console.log,
      prefix: '/forest',
      forestServerUrl: 'https://api.development.forestadmin.com',
      isProduction: false,
      schemaPath: '.forestadmin-schema.json',
      ...forestAdminHttpDriverOptions,
    } as ForestAdminHttpDriverOptions;
  }

  build(): this {
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

    return this;
  }

  addDatasource(datasource: DataSource): this {
    datasource.collections.forEach(c => this.compositeDatasource.addCollection(c));

    return this;
  }

  collection(name: string, handle: (collection: CollectionBuilder) => unknown): this {
    if (this.search.getCollection(name)) {
      handle(new CollectionBuilder(this, name));
    } else {
      const names = this.search.collections.map(c => c.name);
      const message = names.length
        ? `'${name}' is not one of the known collections: ${names}`
        : `No collections are registered`;

      throw new Error(message);
    }

    return this;
  }

  async start(): Promise<void> {
    this.forestAdminHttpDriver = new ForestAdminHttpDriver(this.search, this.driverOptions);

    return this.forestAdminHttpDriver.start();
  }

  async stop(): Promise<void> {
    return this.forestAdminHttpDriver.stop();
  }
}
