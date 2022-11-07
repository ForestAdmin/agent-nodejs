import ChainedSQLQueryError from './errors/chained-sql-query-error';
import EmptySQLQueryError from './errors/empty-sql-query-error';
import NonSelectSQLQueryError from './errors/non-select-sql-query-error';

const QUERY_SELECT = /^SELECT\s[^]*FROM\s[^]*$/i;

export default function verifySQLQuery(inputQuery: string | null): boolean {
  const inputQueryTrimmed = inputQuery?.trim();

  if (!inputQueryTrimmed) {
    throw new EmptySQLQueryError();
  }

  if (
    inputQueryTrimmed.includes(';') &&
    inputQueryTrimmed.indexOf(';') < inputQueryTrimmed.length - 1
  ) {
    throw new ChainedSQLQueryError();
  }

  if (!QUERY_SELECT.test(inputQueryTrimmed)) {
    throw new NonSelectSQLQueryError();
  }

  return true;
}
