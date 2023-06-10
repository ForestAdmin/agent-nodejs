// eslint-disable-next-line max-classes-per-file
import ConnectionOptionsWrapper from '../connection-options-wrapper';

export type SourceError = 'Proxy' | 'Database';

function sanitizeUri(uri: string): string {
  const uriObject = new URL(uri);
  if (uriObject.password) uriObject.password = '**sanitizedPassword**';

  return uriObject.toString();
}

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
  constructor(
    message: string,
    options?: ConnectionOptionsWrapper,
    source: SourceError = 'Database',
  ) {
    if (options && options.uriAsString) {
      const sanitizedUri = sanitizeUri(options.uriAsString);
      super(`Unable to connect to the given uri: ${sanitizedUri}.`, message);
      this.uri = sanitizedUri;
    } else {
      super(`Unable to connect to the given uri/options.`, message);
    }

    this.name = this.constructor.name;
    this.source = source;
  }
}

export class ProxyConnectError extends BaseError {
  constructor(message: string, options?: ConnectionOptionsWrapper) {
    const defaultMessage = 'Your proxy has encountered an error.';

    if (options && options.uriAsString) {
      // remove tcp protocol because its not added by the user
      const sanitizedUri = sanitizeUri(options.proxyUriAsString).replace('tcp://', '');
      super(`${defaultMessage} Unable to connect to the given uri: ${sanitizedUri}.`, message);
      this.uri = sanitizedUri;
    } else {
      super(defaultMessage, message);
    }

    this.name = this.constructor.name;
    this.source = 'Proxy';
  }
}
