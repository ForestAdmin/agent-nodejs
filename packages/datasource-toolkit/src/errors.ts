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

function buildPath(fieldName: string, collectionName?: string): string {
  return collectionName ? `${collectionName}.${fieldName}` : fieldName;
}

type MissingFieldErrorOptions = {
  fieldName: string;
  availableFields: string[];
  collectionName?: string;
};

function buildMessageMissingElement(options: {
  typeOfField: 'Field' | 'Column' | 'Relation';
  fieldName: string;
  availableFields: string[];
  collectionName?: string;
}): string {
  const { typeOfField, fieldName, availableFields, collectionName } = options;
  const path = buildPath(fieldName, collectionName);

  return `The '${path}' ${typeOfField.toLowerCase()} was not found. Available ${typeOfField.toLowerCase()}s are: [${availableFields}]. Please check if the ${typeOfField.toLowerCase()} name is correct.`;
}

export class RelationFieldAccessDeniedError extends ValidationError {
  constructor(options: Pick<MissingFieldErrorOptions, 'fieldName' | 'collectionName'>) {
    const { fieldName, collectionName } = options;
    const path = buildPath(fieldName, collectionName);

    super(
      `Access to the '${path}' field is denied. You are trying to access a field from a related entity, but this is not allowed in the current context. Please verify the field name and context of use.`,
    );
  }
}

export class MissingFieldError extends MissingSchemaElementError {
  constructor(options: MissingFieldErrorOptions) {
    super(buildMessageMissingElement({ typeOfField: 'Field', ...options }));
  }
}

export class MissingColumnError extends MissingSchemaElementError {
  constructor(options: MissingFieldErrorOptions) {
    super(buildMessageMissingElement({ typeOfField: 'Column', ...options }));
  }
}

export class MissingRelationError extends MissingSchemaElementError {
  constructor(options: MissingFieldErrorOptions) {
    super(buildMessageMissingElement({ typeOfField: 'Relation', ...options }));
  }
}

export class AlreadyDefinedFieldError extends ValidationError {
  constructor(options: { fieldName: string; collectionName?: string }) {
    const { fieldName, collectionName } = options;
    const path = buildPath(fieldName, collectionName);

    super(
      `The '${path}' field is already defined. Please check if the field name is correct and unique.`,
    );
  }
}
