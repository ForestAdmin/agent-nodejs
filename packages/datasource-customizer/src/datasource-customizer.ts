import { Collection, DataSource, DataSourceFactory, Logger } from '@forestadmin/datasource-toolkit';

import { ChartDefinition } from './decorators/chart/types';
import { DataSourceOptions } from './types';
import { TCollectionName, TSchema } from './templates';
import CollectionCustomizer from './collection-customizer';
import CompositeDatasource from './decorators/composite-datasource';
import DecoratorsStack from './decorators/decorators-stack';
import RenameCollectionDataSourceDecorator from './decorators/rename-collection/datasource';
import TypingGenerator from './typing-generator';

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
export default class DataSourceCustomizer<S extends TSchema = TSchema> {
  private readonly compositeDataSource: CompositeDatasource<Collection>;
  private readonly stack: DecoratorsStack;
  private customizations: ((logger: Logger) => Promise<void>)[] = [];

  constructor() {
    this.compositeDataSource = new CompositeDatasource<Collection>();
    this.stack = new DecoratorsStack(this.compositeDataSource);
  }

  /**
   * Add a datasource
   * @param factory the datasource to add
   * @param options the options
   */
  addDataSource(factory: DataSourceFactory, options?: DataSourceOptions): this {
    this.customizations.push(async logger => {
      const dataSource = await factory(logger);
      const renamedDecorator = new RenameCollectionDataSourceDecorator(dataSource);
      renamedDecorator.renameCollections(options?.rename);

      this.compositeDataSource.addDataSource(renamedDecorator);
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
    handle: (collection: CollectionCustomizer<S, N>) => unknown,
  ): this {
    this.customizations.push(async () => {
      if (this.stack.dataSource.getCollection(name)) {
        handle(new CollectionCustomizer<S, N>(this.stack, name));
      }
    });

    return this;
  }

  async getDataSource(logger: Logger): Promise<DataSource> {
    while (this.customizations.length) {
      await this.customizations.shift()(logger); // eslint-disable-line no-await-in-loop
    }

    return this.stack.dataSource;
  }

  getFactory(): DataSourceFactory {
    return async (logger: Logger) => this.getDataSource(logger);
  }

  async updateTypesOnFileSystem(typingsPath: string, typingsMaxDepth: number): Promise<void> {
    return TypingGenerator.updateTypesOnFileSystem(this.stack.hook, typingsPath, typingsMaxDepth);
  }
}
