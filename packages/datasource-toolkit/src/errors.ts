// eslint-disable-next-line max-classes-per-file
export class BusinessError extends Error {
  public readonly data: Record<string, unknown> | undefined;

  constructor(message?: string, data?: Record<string, unknown>, name?: string) {
    super(message);
    this.name = name ?? this.constructor.name;
    this.data = data;
  }

  /**
   * We cannot rely on `instanceof` because there can be some mismatch between
   * packages versions as dependencies of different packages.
   * So this function is a workaround to check if an error is of a specific type.
   */
  static isOfType(error: Error, ErrorConstructor: new (...args: any[]) => Error): boolean {
    return error.name === ErrorConstructor.name;
  }
}

export class ValidationError extends BusinessError {}
export class UnprocessableError extends BusinessError {}
export class ForbiddenError extends BusinessError {}

export class IntrospectionFormatError extends BusinessError {
  constructor(sourcePackageName: '@forestadmin/datasource-sql' | '@forestadmin/datasource-mongo') {
    const message =
      `This version of introspection is newer than this package version. ` +
      `Please update ${sourcePackageName}`;
    super(message);
  }

  /** @deprecated use name instead */
  public get type() {
    return this.name;
  }
}
