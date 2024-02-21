import type {
  CollectionCustomizer,
  DataSourceChartDefinition,
  Plugin,
  TCollectionName,
  TSchema,
} from '@forestadmin/datasource-customizer';

import BootstrapPathManager from './services/bootstrap-path-manager';
import DistPathManager from './services/dist-path-manager';
import EventSubscriber from './services/event-subscriber';
import HttpServer from './services/http-server';

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
  TOKEN_PATH: string;
  FOREST_ENV_SECRET: string;
  FOREST_SERVER_URL: string;
  FOREST_SUBSCRIPTION_URL: string;
  FOREST_AUTH_TOKEN: string;
  NODE_TLS_REJECT_UNAUTHORIZED: string;
};

export type MakeCommands = {
  buildEventSubscriber: BuildEventSubscriber;
  buildHttpServer: BuildHttpServer;
  getEnvironmentVariables: () => Promise<EnvironmentVariables>;
  getCurrentVersion: () => string;
  bootstrapPathManager: BootstrapPathManager;
  distPathManager: DistPathManager;
  logger: Logger;
  login: Login;
};

export type Spinner = {
  start: (text?: string) => void;
  succeed: (text?: string) => void;
  warn: (text?: string) => void;
  info: (text?: string) => void;
  fail: (text?: string) => void;
  stop: () => void;
};

export type Logger = {
  spinner: Spinner;
  info: (text?: string) => void;
  log: (text?: string) => void;
  error: (text?: string) => void;
  warn: (text?: string) => void;
  debug: (text?: string) => void;
};

export type Login = (logger: Logger) => Promise<void>;

export type BuildHttpServer = (envs: EnvironmentVariables) => HttpServer;

export type BuildEventSubscriber = (vars: EnvironmentVariables) => EventSubscriber;
