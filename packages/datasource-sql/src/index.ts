import { DataSourceFactory, Logger, LoggerLevel } from '@forestadmin/datasource-toolkit';
import SqlDataSource from './datasource';

export default async function makeSqlDataSource(connectionUri: string): Promise<DataSourceFactory> {
  // Before being added to the agent, accumulate logs in a list.
  const logs = [];

  let logger = (level: LoggerLevel, message: unknown) => {
    logs.push({ level, message });
  };

  // Start datasource
  const wrapper = (level: LoggerLevel, message: unknown) => logger(level, message);
  const dataSource = new SqlDataSource(connectionUri, wrapper);
  await dataSource.build();

  // Once added to the agent, prune queued logs.
  return (agentLogger: Logger) => {
    logs.forEach(({ level, message }) => logger(level, message));
    logger = agentLogger;

    return dataSource;
  };
}
