import {
  Collection,
  DataSource,
  DataSourceFactory,
  DataSourceSchema,
  Logger,
} from '@forestadmin/datasource-toolkit';

import { DataSourceChartDefinition } from './decorators/chart/types';
import { DataSourceOptions, Plugin } from './types';
import { TCollectionName, TSchema } from './templates';
import CollectionCustomizer from './collection-customizer';
import CompositeDatasource from './decorators/composite-datasource';
import DecoratorsStack from './decorators/decorators-stack';
import PublicationCollectionDataSourceDecorator from './decorators/publication-collection/datasource';
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

  /**
   * Retrieve schema of the agent
   */
  get schema(): DataSourceSchema {
    return this.stack.hook.schema;
  }

  /**
   * Get list of customizable collections
   */
  get collections(): CollectionCustomizer<S>[] {
    return this.stack.hook.collections.map(c => this.getCollection(c.name as TCollectionName<S>));
  }

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
    this.stack.queueCustomization(async logger => {
      let dataSource = await factory(logger);

      if (options?.include || options?.exclude) {
        const publicationDecorator = new PublicationCollectionDataSourceDecorator(dataSource);
        publicationDecorator.keepCollectionsMatching(options.include, options.exclude);
        dataSource = publicationDecorator;
      }

      if (options?.rename) {
        const renamedDecorator = new RenameCollectionDataSourceDecorator(dataSource);
        renamedDecorator.renameCollections(options?.rename);
        dataSource = renamedDecorator;
      }

      this.compositeDataSource.addDataSource(dataSource);
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
  addChart(name: string, definition: DataSourceChartDefinition<S>): this {
    this.stack.queueCustomization(async () => {
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
    handle(this.getCollection(name));

    return this;
  }

  /**
   * Get given collection by name
   * @param name name of the collection
   */
  getCollection<N extends TCollectionName<S>>(name: N): CollectionCustomizer<S, N> {
    return new CollectionCustomizer<S, N>(this, this.stack, name);
  }

  /**
   * Load a plugin across all collections
   * @param plugin instance of the plugin
   * @param options options which need to be passed to the plugin
   * @example
   * import { advancedExport } from '@forestadmin/plugin-advanced-export';
   *
   * dataSourceCustomizer.use(advancedExportPlugin, { format: 'xlsx' });
   */
  use<Options>(plugin: Plugin<Options>, options?: Options): this {
    this.stack.queueCustomization(async () => {
      await plugin(this, null, options);
    });

    return this;
  }

  async getDataSource(logger: Logger): Promise<DataSource> {
    await this.stack.applyQueuedCustomizations(logger);

    return this.stack.dataSource;
  }

  getFactory(): DataSourceFactory {
    return async (logger: Logger) => this.getDataSource(logger);
  }

  async updateTypesOnFileSystem(typingsPath: string, typingsMaxDepth: number): Promise<void> {
    return TypingGenerator.updateTypesOnFileSystem(this.stack.hook, typingsPath, typingsMaxDepth);
  }
}
