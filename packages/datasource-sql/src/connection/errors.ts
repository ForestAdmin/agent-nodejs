// eslint-disable-next-line max-classes-per-file
export class BaseError extends Error {
  public readonly uri: string;

  constructor(message: string, uri: string) {
    super(message);

    this.uri = uri;
    this.name = this.constructor.name;
  }
}

export class HostNotFoundError extends BaseError {
  constructor(databaseUri: string) {
    const hostWithPort = new URL(databaseUri).host;
    super(`Unable to connect to the host "${hostWithPort}".`, databaseUri);
    this.name = this.constructor.name;
  }
}

export class AccessDeniedError extends BaseError {
  constructor(databaseUri: string) {
    const { host, username: user } = new URL(databaseUri);
    super(
      `Access denied for user "${user}" on host "${host}".
       Please check your credentials and your host.`,
      databaseUri,
    );
    this.name = this.constructor.name;
  }
}

export class ConnectionAcquireTimeoutError extends BaseError {
  constructor(databaseUri: string) {
    const hostWithPort = new URL(databaseUri).host;
    super(
      `Unable to connect to the host "${hostWithPort}". The connection timed out.`,
      databaseUri,
    );
    this.name = this.constructor.name;
  }
}

export class TooManyConnectionError extends BaseError {
  constructor(databaseUri: string) {
    const hostWithPort = new URL(databaseUri).host;
    super(
      `Unable to connect to the host "${hostWithPort}".
       There is too many connection to the database.`,
      databaseUri,
    );
    this.name = this.constructor.name;
  }
}

export class ProxyError extends BaseError {}
export class UnexpectedProxyError extends ProxyError {
  constructor(proxyUri: string, message: string) {
    super(
      `Your proxy has encountered an unexpected error. Please check your proxy configuration.
       Details: ${message}`,
      proxyUri,
    );
    this.name = this.constructor.name;
  }
}

export class ConnectionProxyError extends ProxyError {
  constructor(proxyUri: string, message: string) {
    super(
      `Unable to connect to the host.
       Details: ${message}`,
      proxyUri,
    );
    this.name = this.constructor.name;
  }
}

export class AccessDeniedProxyError extends ProxyError {
  constructor(proxyUri: string, message: string) {
    const { host, username: user } = new URL(proxyUri);

    super(
      `Access denied for user "${user}" on host "${host}".
       Please check your credentials and your host.
       Details: ${message}`,
      proxyUri,
    );
    this.name = this.constructor.name;
  }
}

export class DatabaseError extends BaseError {
  constructor(databaseUri: string, message: string) {
    const hostWithPort = new URL(databaseUri).host;
    super(
      `Unable to connect to the host "${hostWithPort}".
       Details: ${message}`,
      databaseUri,
    );
    this.name = this.constructor.name;
  }
}
