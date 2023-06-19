/* eslint-disable max-classes-per-file */
export abstract class ServiceError extends Error {
  readonly parentError: Error;

  constructor(parentError: Error) {
    super(parentError.message);
    this.parentError = parentError;
  }
}

export class SshServiceError extends ServiceError {}

export class SshConnectServiceError extends SshServiceError {}

export class SshForwardServiceError extends SshServiceError {}

export class SocksProxyServiceError extends ServiceError {}
