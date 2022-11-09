import DataSource from './implementations/datasource/datasource';

/** Logger */
export type LoggerLevel = 'Debug' | 'Info' | 'Warn' | 'Error';
export type Logger = (level: LoggerLevel, message: unknown) => void;

/** Function which generates datasources */
export type DataSourceFactory = (logger: Logger) => Promise<DataSource>;
