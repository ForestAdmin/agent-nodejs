import {
  ChartDefinition,
  Collection,
  CompositeDatasource,
  DataSourceFactory,
  RenameCollectionDataSourceDecorator,
  TCollectionName,
  TSchema,
} from '@forestadmin/datasource-toolkit';

import { AgentOptions } from '../types';
import { AgentOptionsWithDefaults } from '../agent/types';
import { DataSourceOptions } from './types';
import CollectionCustomizer from './collection';
import DecoratorsStack from './decorators-stack';
import ForestAdminHttpDriver from '../agent/forestadmin-http-driver';
import FrameworkMounter from './framework-mounter';
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
export default class AgentBuilder<S extends TSchema = TSchema> extends FrameworkMounter {
  private readonly compositeDataSource: CompositeDatasource<Collection>;
  private readonly stack: DecoratorsStack;
  private readonly options: AgentOptionsWithDefaults;
  private customizations: (() => Promise<void>)[] = [];

  /**
   * Create a new Agent Builder.
   * If any options are missing, the default will be applied:
   * ```
   *  forestServerUrl: 'https://api.forestadmin.com',
   *  logger: (level, data) => console.error(level, data),
   *  prefix: 'api/v1',
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
    const allOptions = OptionsValidator.validate(OptionsValidator.withDefaults(options));
    super(allOptions.prefix, allOptions.logger);

    this.options = allOptions;
    this.compositeDataSource = new CompositeDatasource<Collection>();
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

  /**
   * Start the agent.
   */
  override async start(): Promise<void> {
    // Customize agent
    for (const task of this.customizations) await task(); // eslint-disable-line no-await-in-loop

    // Write typings file
    if (!this.options.isProduction && this.options.typingsPath) {
      await TypingGenerator.updateTypesOnFileSystem(
        this.stack.action,
        this.options.typingsPath,
        this.options.typingsMaxDepth,
      );
    }

    const httpDriver = new ForestAdminHttpDriver(this.stack.dataSource, this.options);
    await httpDriver.sendSchema();

    const router = await httpDriver.getRouter();
    super.start(router);
  }
}
