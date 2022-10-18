import { UnprocessableError } from '@forestadmin/datasource-toolkit';

export default class EmptySQLQueryError extends UnprocessableError {
  constructor() {
    super('You cannot execute an empty SQL query.');
  }
}
