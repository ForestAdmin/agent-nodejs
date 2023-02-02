// eslint-disable-next-line max-classes-per-file
export class ConnectionError extends Error {
  constructor(message: string) {
    super(`Connection error: ${message}`);
  }
}
export class HostNotFoundError extends Error {
  constructor(message: string) {
    super(`Host not found error: ${message}`);
  }
}
export class ConnectionRefusedError extends Error {
  constructor(message: string) {
    super(`Connection refused error: ${message}`);
  }
}
export class HostNotReachableError extends Error {
  constructor(message: string) {
    super(`Host not reachable: ${message}`);
  }
}

export class AccessDeniedError extends Error {
  constructor(message: string) {
    super(`Access denied: ${message}`);
  }
}
export class InvalidConnectionError extends Error {
  constructor(message: string) {
    super(`Invalid connection: ${message}`);
  }
}

export class ConnectionAcquireTimeoutError extends Error {
  constructor(message: string) {
    super(`Connection acquire timeout: ${message}`);
  }
}

export class ConnectionTimedOutError extends Error {
  constructor(message: string) {
    super(`Connection timed out: ${message}`);
  }
}
