import { UnprocessableError } from '@forestadmin/datasource-toolkit';

export default class NonSelectSQLQueryError extends UnprocessableError {
  constructor() {
    super('Only SELECT queries are allowed.');
  }
}
