// eslint-disable-next-line max-classes-per-file
import ConnectionOptionsWrapper from '../connection-options-wrapper';
import { ConnectionOptionsObj } from '../types';

export type SourceError = 'Proxy' | 'Database';

class BaseError extends Error {
  public source: SourceError;
  public uri: string;
  public readonly details: string;

  constructor(message: string, details?: string) {
    const messageWithDetails = details ? `${message}\n${details}` : message;
    super(messageWithDetails);

    this.details = details;
  }
}

export class DatabaseConnectError extends BaseError {
  constructor(message: string, options?: ConnectionOptionsObj, source: SourceError = 'Database') {
    if (options) {
      const sanitizedUri = new ConnectionOptionsWrapper(options).sanitizedUriAsString;
      super(`Unable to connect to the given uri: ${sanitizedUri}.`, message);

      this.name = this.constructor.name;
      this.source = source;
    } else {
      super(`Unable to connect to the given uri.`, message);
    }
  }
}

export class ProxyConnectError extends BaseError {
  constructor(message: string, options?: ConnectionOptionsObj) {
    const defaultMessage = 'Your proxy has encountered an error.';

    if (options) {
      const sanitizedUri = new ConnectionOptionsWrapper(options).sanitizedProxySocksAsUriString;
      super(`${defaultMessage} Unable to connect to the given uri: ${sanitizedUri}.`, message);
      this.uri = sanitizedUri;
    } else {
      super(defaultMessage, message);
    }

    this.name = this.constructor.name;
    this.source = 'Proxy';
  }
}
