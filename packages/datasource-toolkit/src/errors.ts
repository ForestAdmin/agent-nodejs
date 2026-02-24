/* eslint-disable max-classes-per-file */
import { BusinessError, ValidationError } from '@forestadmin/agent-toolkit';

// Re-export base errors from agent-toolkit for backward compatibility
export {
  BusinessError,
  ValidationError,
  BadRequestError,
  UnprocessableError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  TooManyRequestsError,
} from '@forestadmin/agent-toolkit';

export class IntrospectionFormatError extends BusinessError {
  constructor(sourcePackageName: '@forestadmin/datasource-sql' | '@forestadmin/datasource-mongo') {
    const message =
      `This version of introspection is newer than this package version. ` +
      `Please update ${sourcePackageName}`;
    super(message, undefined, undefined, 'IntrospectionFormatError');
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
