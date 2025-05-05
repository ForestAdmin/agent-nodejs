import {
  Collection,
  DataSource,
  DataSourceFactory,
  DataSourceSchema,
  Logger,
} from '@forestadmin/datasource-toolkit';

import CollectionCustomizer from './collection-customizer';
import { DataSourceChartDefinition } from './decorators/chart/types';
import CompositeDatasource from './decorators/composite-datasource';
import DecoratorsStack from './decorators/decorators-stack';
import DecoratorsStackNoCode from './decorators/decorators-stack-no-code';
import PublicationDataSourceDecorator from './decorators/publication/datasource';
import RenameCollectionDataSourceDecorator from './decorators/rename-collection/datasource';
import { TCollectionName, TSchema } from './templates';
import { DataSourceOptions, Plugin } from './types';
import TypingGenerator from './typing-generator';

export type Options = {
  ignoreMissingSchemaElementErrors?: boolean;
  strategy?: 'Normal' | 'NoCode';
};

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
  private compositeDataSource: CompositeDatasource<Collection>;
  private readonly stack: DecoratorsStack;
  public publicServices?: {
    sendNotifications: (payload: object) => Promise<void>;
  };

  /**
   * Retrieve schema of the agent
   */
  get schema(): DataSourceSchema {
    return this.stack.validation.schema;
  }

  /**
   * Get list of customizable collections
   */
  get collections(): CollectionCustomizer<S>[] {
    return this.stack.validation.collections.map(c =>
      this.getCollection(c.name as TCollectionName<S>),
    );
  }

  constructor(options?: Options) {
    this.stack = new {
      NoCode: DecoratorsStackNoCode,
      Normal: DecoratorsStack,
    }[options?.strategy ?? 'Normal'](options);
  }

  /**
   * Add a datasource
   * @param factory the datasource to add
   * @param options the options
   */
  addDataSource(
    factory: DataSourceFactory,
    options?: DataSourceOptions,
    restartAgentFunction?: () => Promise<void>,
  ): this {
    this.stack.queueCustomization(async logger => {
      let dataSource = await factory(logger, restartAgentFunction);

      if (options?.include || options?.exclude) {
        const publicationDecorator = new PublicationDataSourceDecorator(dataSource, logger);
        publicationDecorator.keepCollectionsMatching(options.include, options.exclude);
        dataSource = publicationDecorator;
      }

      if (options?.rename) {
        const renamedDecorator = new RenameCollectionDataSourceDecorator(dataSource);
        renamedDecorator.renameCollections(options.rename);
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
   * Find a collection by name. Returns undefined if the collection is missing
   * @param name name of the collection
   */
  findCollection(name: string): CollectionCustomizer<S> | undefined {
    if (this.collections.find(collection => collection.name === name)) {
      /**
       * If the collection is found, we use the getCollection to apply side effects
       */
      return this.getCollection(name as TCollectionName<S>);
    }
  }

  /**
   * Remove collections from the exported schema (they will still be usable within the agent).
   * @param names the collections to remove
   * @example
   * .removeCollection('aCollectionToRemove', 'anotherCollectionToRemove');
   */
  removeCollection(...names: TCollectionName<S>[]): this {
    this.stack.queueCustomization(async () => {
      this.stack.publication.keepCollectionsMatching(undefined, names);
    });

    return this;
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
  use<TOptions>(plugin: Plugin<TOptions>, options?: TOptions): this {
    this.stack.queueCustomization(async () => {
      await plugin(this, null, options);
    });

    return this;
  }

  async getDataSource(logger: Logger): Promise<DataSource> {
    let datasource = this.stack.dataSource;

    try {
      this.compositeDataSource = new CompositeDatasource<Collection>();
      await this.stack.applyQueuedCustomizations(logger, this.compositeDataSource);

      datasource = this.stack.dataSource;
    } catch (error) {
      if (!datasource) {
        throw error;
      } else {
        logger(
          'Error',
          `Agent failed to restart with the new configuration. Retaining the previous one.\n  ${error}`,
        );
      }
    }

    return datasource;
  }

  getFactory(): DataSourceFactory {
    return async (logger: Logger) => this.getDataSource(logger);
  }

  async updateTypesOnFileSystem(
    typingsPath: string,
    typingsMaxDepth: number,
    logger?: Logger,
  ): Promise<void> {
    const typingGenerator = new TypingGenerator(logger);

    return typingGenerator.updateTypesOnFileSystem(this.stack.hook, typingsPath, typingsMaxDepth);
  }
}
