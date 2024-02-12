import type {
  CollectionCustomizer,
  DataSourceChartDefinition,
  Plugin,
  TCollectionName,
  TSchema,
} from '@forestadmin/datasource-customizer';

import EventSubscriber from './services/event-subscriber';
import HttpForestServer from './services/http-forest-server';

/**
 * This agent the central object used to customize your cloud project
 * some methods available in self-hosted, such as:
 * @method addDataSource are currently not supported in cloud
 */
export type Agent<S extends TSchema = TSchema> = {
  /**
   * Allow to interact with a decorated collection
   * @param name the name of the collection to manipulate
   * @param handle a function that provide a collection builder on the given collection name
   * @see {@link https://docs.forestadmin.com/developer-guide-agents-nodejs/agent-customization/agent-customization Documentation Link}
   * @example
   * .customizeCollection('books', books => books.renameField('xx', 'yy'))
   */
  customizeCollection<N extends TCollectionName<S>>(
    name: N,
    handle: (collection: CollectionCustomizer<S, N>) => unknown,
  ): Agent<S>;

  /**
   * Remove collections from the exported schema (they will still be usable within the agent).
   * @param names the collections to remove
   * @example
   * .removeField('aCollectionToRemove', 'anotherCollectionToRemove');
   */
  removeCollection(...names: TCollectionName<S>[]): Agent<S>;

  /**
   * Create a new API chart
   * @param name name of the chart
   * @param definition definition of the chart
   * @see {@link https://docs.forestadmin.com/developer-guide-agents-nodejs/agent-customization/charts Documentation Link}
   * @example
   * .addChart('numCustomers', (context, resultBuilder) => {
   *   return resultBuilder.distribution({
   *     tomatoes: 10,
   *     potatoes: 20,
   *     carrots: 30,
   *   });
   * })
   */
  addChart(name: string, definition: DataSourceChartDefinition<S>): Agent<S>;

  /**
   * Load a plugin across all collections
   * @param plugin instance of the plugin
   * @param options options which need to be passed to the plugin
   * @see {@link https://docs.forestadmin.com/developer-guide-agents-nodejs/agent-customization/plugins Documentation Link}
   * @example
   * import advancedExportPlugin from '@forestadmin/plugin-advanced-export';
   *
   * agent.use(advancedExportPlugin, { format: 'xlsx' });
   */
  use<Options>(plugin: Plugin<Options>, options?: Options): Agent<S>;
};

export type EnvironmentVariables = {
  FOREST_ENV_SECRET: string;
  FOREST_SERVER_URL: string;
  FOREST_SUBSCRIPTION_URL: string;
  FOREST_AUTH_TOKEN: string;
};

export type MakeCommands = {
  getOrRefreshEnvironmentVariables: () => Promise<EnvironmentVariables>;
  getEnvironmentVariables: () => Promise<EnvironmentVariables>;
  buildHttpForestServer: (envs: EnvironmentVariables) => HttpForestServer;
  buildEventSubscriber: (envs: EnvironmentVariables) => EventSubscriber;
};
