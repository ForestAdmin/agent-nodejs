// eslint-disable-next-line max-classes-per-file
export class BusinessError extends Error {
  public readonly data: Record<string, unknown> | undefined;

  constructor(message?: string, data?: Record<string, unknown>, name?: string) {
    super(message);
    this.name = name ?? this.constructor.name;
    this.data = data;
  }
}

export class ValidationError extends BusinessError {}
export class UnprocessableError extends BusinessError {}
export class ForbiddenError extends BusinessError {}

export class IntrospectionFormatError extends Error {
  constructor(sourcePackageName: '@forestadmin/datasource-sql' | '@forestadmin/datasource-mongo') {
    const message =
      `This version of introspection is newer than this package version. ` +
      `Please update ${sourcePackageName}`;
    super(message);
  }
}
