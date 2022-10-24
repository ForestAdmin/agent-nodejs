export default class ChainedSQLQueryError extends Error {
  constructor() {
    super('You cannot chain SQL queries.');
  }
}
