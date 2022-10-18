import { UnprocessableError } from '@forestadmin/datasource-toolkit';

export default class ChainedSQLQueryError extends UnprocessableError {
  constructor() {
    super('You cannot chain SQL queries.');
  }
}
