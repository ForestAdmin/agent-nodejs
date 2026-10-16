/* eslint-disable max-classes-per-file */
import {
  BadRequestError,
  ForbiddenError,
  InternalServerError,
  UnprocessableError,
} from '@forestadmin/datasource-toolkit';

export class ScanDeniedError extends ForbiddenError {}

export class ScanLimitExceededError extends UnprocessableError {}

export class OffsetTooDeepError extends BadRequestError {}

export class DynamoDBOperationError extends InternalServerError {
  constructor(message: string, cause: unknown) {
    super(message);
    Object.assign(this, { cause });
  }
}
