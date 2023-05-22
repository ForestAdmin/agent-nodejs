export class BaseError extends Error {
  public readonly databaseUri: string;

  constructor(message: string, databaseUri: string) {
    super(`Connection error: ${message}`);

    this.databaseUri = databaseUri;
  }
}

export class HostNotFoundError extends BaseError {
  constructor(databaseUri: string) {
    const hostWithPort = new URL(databaseUri).host;
    super(`Unable to connect to the host "${hostWithPort}".`, databaseUri);
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
  }
}

export class ConnectionAcquireTimeoutError extends BaseError {
  constructor(databaseUri: string) {
    const hostWithPort = new URL(databaseUri).host;
    super(
      `Unable to connect to the host "${hostWithPort}". The connection timed out.`,
      databaseUri,
    );
  }
}

export class UnexpectedProxyError extends BaseError {
  constructor(databaseUri: string) {
    super(
      'An unexpected error occurred while contacting the ForestAdmin server.' +
        ' Please contact support@forestadmin.com for further investigations.',

      databaseUri,
    );
  }
}
