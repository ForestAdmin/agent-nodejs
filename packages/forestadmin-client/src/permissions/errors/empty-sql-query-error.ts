export default class EmptySQLQueryError extends Error {
  constructor() {
    super('You cannot execute an empty SQL query.');
  }
}
