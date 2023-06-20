/* eslint-disable max-classes-per-file */

export type ErrorSource = 'Proxy' | 'Database' | 'Ssh';

abstract class BaseError extends Error {
  abstract readonly source: ErrorSource;
  readonly uri: string;
  readonly details: string;

  protected constructor(message: string, uri: string, details?: string) {
    super(details ? `${message}\n${details}` : message);

    this.name = this.constructor.name;
    this.details = details;
    this.uri = uri;
  }
}

export class DatabaseConnectError extends BaseError {
  readonly source: ErrorSource;

  constructor(message: string, debugDatabaseUri: string, source: ErrorSource = 'Database') {
    super(`Unable to connect to the given uri: ${debugDatabaseUri}.`, debugDatabaseUri, message);

    this.source = source;
  }
}

export class ProxyConnectError extends BaseError {
  readonly source = 'Proxy';

  constructor(message: string, debugProxyUri: string) {
    // remove tcp protocol because its not added by the user
    const sanitizedUri = debugProxyUri.replace('tcp://', '');

    super(
      `Your proxy has encountered an error. Unable to connect to the given uri: ${sanitizedUri}.`,
      sanitizedUri,
      message,
    );
  }
}

export class SshConnectError extends BaseError {
  readonly source: ErrorSource;

  constructor(message: string, debugSshUri: string, source: ErrorSource = 'Ssh') {
    const sanitizedUri = debugSshUri.replace('tcp://', '');

    super(
      `Your ssh connection has encountered an error. ` +
        `Unable to connect to the given ssh uri: ${sanitizedUri}`,
      sanitizedUri,
      message,
    );
    this.source = source;
  }
}
