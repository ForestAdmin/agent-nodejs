/* eslint-disable max-classes-per-file */
import { BusinessError } from '@forestadmin/datasource-toolkit';

export type ErrorSource = 'Proxy' | 'Database' | 'Ssh';

abstract class BaseError extends BusinessError {
  abstract readonly source: ErrorSource;
  readonly debugUri: string;
  readonly details: string;

  protected constructor(message: string, debugUri: string, details?: string) {
    super(details ? `${message}\n${details}` : message);

    this.details = details;
    this.debugUri = debugUri;
  }
}

export class DatabaseConnectError extends BaseError {
  readonly source: ErrorSource;

  constructor(message: string, debugDatabaseUri: string, source: ErrorSource = 'Database') {
    // remove tcp protocol because its not added by the user
    const sanitizedUri = debugDatabaseUri.replace('tcp://', '');
    super(`Unable to connect to the given uri: ${sanitizedUri}.`, sanitizedUri, message);

    this.source = source;
  }
}

export class ProxyConnectError extends BaseError {
  readonly source = 'Proxy';

  constructor(message: string, debugProxyUri: string) {
    super(
      `Your proxy has encountered an error. Unable to connect to the given uri: ${debugProxyUri}.`,
      debugProxyUri,
      message,
    );
  }
}

export class ProxyForwardError extends BaseError {
  readonly source = 'Proxy';

  constructor(message: string, debugForwardedUri: string) {
    super(
      `Your proxy forwarded connection has encountered an error.` +
        `Unable to connect to the given uri: ${debugForwardedUri}.`,
      debugForwardedUri,
      message,
    );
  }
}

export class SshConnectError extends BaseError {
  readonly source: ErrorSource;

  constructor(message: string, debugSshUri: string, source: ErrorSource = 'Ssh') {
    super(
      `Your ssh connection has encountered an error. ` +
        `Unable to connect to the given ssh uri: ${debugSshUri}`,
      debugSshUri,
      message,
    );
    this.source = source;
  }
}

export class SshForwardError extends BaseError {
  readonly source = 'Ssh';

  constructor(message: string, debugForwardedUri: string) {
    super(
      `Your ssh forward connection has encountered an error. ` +
        `Unable to connect to the given ssh uri: ${debugForwardedUri}`,
      debugForwardedUri,
      message,
    );
  }
}
