export default class NonSelectSQLQueryError extends Error {
  constructor() {
    super('Only SELECT queries are allowed.');
  }
}
