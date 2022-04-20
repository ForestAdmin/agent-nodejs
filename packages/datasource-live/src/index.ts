import {
  DataSourceFactory,
  DataSourceSchema,
  Logger,
  LoggerLevel,
} from '@forestadmin/datasource-toolkit';
import LiveDataSource from './datasource';

export default async function makeLiveDataSource(
  dataSourceSchema: DataSourceSchema,
  seed: (liveDataSource: LiveDataSource) => Promise<void>,
): Promise<DataSourceFactory> {
  // Before being added to the agent, accumulate logs in a list.
  const logs = [];

  let logger = (level: LoggerLevel, message: unknown) => {
    logs.push({ level, message });
  };

  // Start datasource
  const wrapper = (level: LoggerLevel, message: unknown) => logger(level, message);
  const dataSource = new LiveDataSource(dataSourceSchema, wrapper);
  await dataSource.syncCollections();
  if (seed) await seed(dataSource);

  // Once added to the agent, prune queued logs.
  return (agentLogger: Logger) => {
    logs.forEach(({ level, message }) => logger(level, message));
    logger = agentLogger;

    return dataSource;
  };
}

export { LiveDataSource };
