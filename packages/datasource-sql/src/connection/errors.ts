// eslint-disable-next-line max-classes-per-file
import { ConnectionOptionsObj } from '../types';

function sanitizeUri(uri: string): string {
  const uriObject = new URL(uri);

  if (uriObject.password) {
    uriObject.password = '**sanitizedPassword**';
  }

  return uriObject.toString();
}

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
  constructor(message: string, databaseUri?: string, source: SourceError = 'Database') {
    if (databaseUri) {
      const sanitizedUri = sanitizeUri(databaseUri);
      super(`Unable to connect to the given uri: ${sanitizedUri}.`, message);
      this.uri = sanitizedUri;
    } else {
      super(`Unable to connect to the given uri.`, message);
    }

    this.name = this.constructor.name;
    this.source = source;
  }
}

export class ProxyConnectError extends BaseError {
  constructor(message: string, proxyConfig?: ConnectionOptionsObj['proxySocks']) {
    const defaultMessage = 'Your proxy has encountered an error.';

    if (proxyConfig) {
      const sanitizedUri = ProxyConnectError.buildSanitizedUriFromConfig(proxyConfig);
      super(`${defaultMessage} Unable to connect to the given uri: ${sanitizedUri}.`, message);
      this.uri = sanitizedUri;
    } else {
      super(defaultMessage, message);
    }

    this.name = this.constructor.name;
    this.source = 'Proxy';
  }

  private static buildSanitizedUriFromConfig(
    proxyConfig: ConnectionOptionsObj['proxySocks'],
  ): string {
    const proxyUri = new URL(`socks://${proxyConfig.host}:${proxyConfig.port}`);

    if (proxyConfig.userId) {
      proxyUri.username = proxyConfig.userId;
    }

    if (proxyConfig.password) {
      proxyUri.password = proxyConfig.password;
    }

    return sanitizeUri(proxyUri.toString()).replace('socks://', '');
  }
}
