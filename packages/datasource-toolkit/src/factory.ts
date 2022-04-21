import { DataSource } from './interfaces/collection';

/** Logger */
export type LoggerLevel = 'Debug' | 'Info' | 'Warn' | 'Error';
export type Logger = (level: LoggerLevel, message: unknown) => void;

export type DataSourceFactory = (logger: Logger) => Promise<DataSource>;
