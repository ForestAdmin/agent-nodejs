// eslint-disable-next-line max-classes-per-file
function sanitizeUri(uri: string): string {
  const uriObject = new URL(uri);
  uriObject.password = '**sanitizedPassword**';

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

export class DatabaseError extends BaseError {
  constructor(databaseUri: string, details?: string, source: SourceError = 'Database') {
    super(`Unable to connect to the given uri: ${sanitizeUri(databaseUri)}`, details);
    this.name = this.constructor.name;
    this.source = source;
    this.uri = databaseUri;
  }
}

export class ProxyError extends BaseError {
  constructor(proxyUri: string, details?: string) {
    super(
      `Your proxy has encountered an error. Unable to connect to the given uri: ${sanitizeUri(
        proxyUri,
      )}`,
      details,
    );
    this.name = this.constructor.name;
    this.source = 'Proxy';
    this.uri = proxyUri;
  }
}
