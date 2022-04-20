import { DataSource } from './interfaces/collection';

/** Logger Level */
export enum LoggerLevel {
  Info = 'info',
  Warn = 'warn',
  Error = 'error',
}

/** Logger */
export type Logger = (level: LoggerLevel, message: unknown) => void;

export type DataSourceFactory = (logger: Logger) => DataSource;
