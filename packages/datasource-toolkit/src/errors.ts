// eslint-disable-next-line max-classes-per-file
export class BusinessError extends Error {
  // INTERNAL USAGES
  public readonly isBusinessError = true;
  public baseBusinessErrorName: string;

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
  static isOfType(error: Error, ErrorConstructor: new (...args: never[]) => Error): boolean {
    return (
      error.name === ErrorConstructor.name ||
      (error as BusinessError).baseBusinessErrorName === ErrorConstructor.name
    );
  }
}

export class ValidationError extends BusinessError {
  constructor(message?: string, data?: Record<string, unknown>, name?: string) {
    super(message, data, name);
    this.baseBusinessErrorName = 'ValidationError';
  }
}
export class BadRequestError extends BusinessError {
  constructor(message?: string, data?: Record<string, unknown>, name?: string) {
    super(message, data, name);
    this.baseBusinessErrorName = 'BadRequestError';
  }
}
export class UnprocessableError extends BusinessError {
  constructor(message?: string, data?: Record<string, unknown>, name?: string) {
    super(message, data, name);
    this.baseBusinessErrorName = 'UnprocessableError';
  }
}
export class ForbiddenError extends BusinessError {
  constructor(message?: string, data?: Record<string, unknown>, name?: string) {
    super(message, data, name);
    this.baseBusinessErrorName = 'ForbiddenError';
  }
}
export class NotFoundError extends BusinessError {
  constructor(message?: string, data?: Record<string, unknown>, name?: string) {
    super(message, data, name);
    this.baseBusinessErrorName = 'NotFoundError';
  }
}

export class IntrospectionFormatError extends BusinessError {
  constructor(sourcePackageName: '@forestadmin/datasource-sql' | '@forestadmin/datasource-mongo') {
    const message =
      `This version of introspection is newer than this package version. ` +
      `Please update ${sourcePackageName}`;
    super(message);
    this.baseBusinessErrorName = 'IntrospectionFormatError';
  }

  /** @deprecated use name instead */
  public get type() {
    return this.name;
  }
}

// ==== Other errors ====

export class MissingSchemaElementError extends ValidationError {}

export class MissingCollectionError extends MissingSchemaElementError {}

export class MissingFieldError extends MissingSchemaElementError {
  constructor(options: {
    typeOfField: 'Field' | 'Relation' | 'Column';
    fieldName: string;
    availableFields: string[];
    collectionName?: string;
  }) {
    const { typeOfField, fieldName, availableFields, collectionName } = options;
    const path = collectionName ? `${collectionName}.${fieldName}` : fieldName;

    super(
      `The '${path}' ${typeOfField.toLowerCase()} was not found. Available ${typeOfField.toLowerCase()}s are: [${availableFields}]. Please check if the ${typeOfField.toLowerCase()} name is correct.`,
    );
  }
}
