import { DataSource } from './interfaces/collection';

/** Logger */
export type LoggerLevel = 'Debug' | 'Info' | 'Warn' | 'Error';
export type Logger = (level: LoggerLevel, message: string, error?: Error) => void;

/** Function which generates datasources */
export type DataSourceFactory = (logger: Logger) => Promise<DataSource>;
