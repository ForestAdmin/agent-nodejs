/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ChartDefinition,
  CollectionCustomizer,
  DataSourceCustomizer,
  DataSourceOptions,
  Plugin,
  TCollectionName,
  TSchema,
} from '@forestadmin/datasource-customizer';
import { DataSource, DataSourceFactory, Logger } from '@forestadmin/datasource-toolkit';
import Mountable from './framework-mounter';

export default class MountableCustomizer<S extends TSchema = TSchema> extends Mountable {
  private customizer: DataSourceCustomizer<S>;

  constructor(prefix: string, logger: Logger) {
    super(prefix, logger);

    this.customizer = new DataSourceCustomizer<S>();
  }

  /**
   * Add a datasource
   * @param factory the datasource to add
   * @param options the options
   */
  addDataSource(factory: DataSourceFactory, options?: DataSourceOptions): this {
    this.customizer.addDataSource(factory, options);

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
    this.customizer.addChart(name, definition);

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
    this.customizer.customizeCollection(name, handle);

    return this;
  }

  /**
   * Load a plugin across all collections
   * @param plugin instance of the plugin
   * @param options options which need to be passed to the plugin
   * @example
   * import advancedExportPlugin from '@forestadmin/plugin-advanced-export';
   *
   * agent.use(advancedExportPlugin, { format: 'xlsx' });
   */
  use<Options>(plugin: Plugin<Options>, options?: Options): this {
    this.customizer.use(plugin, options);

    return this;
  }

  protected async updateTypesOnFileSystem(
    typingsPath: string,
    typingsMaxDepth: number,
  ): Promise<void> {
    return this.customizer.updateTypesOnFileSystem(typingsPath, typingsMaxDepth);
  }

  protected async getDataSource(logger: Logger): Promise<DataSource> {
    return this.customizer.getDataSource(logger);
  }
}
