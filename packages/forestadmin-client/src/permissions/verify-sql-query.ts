import ChainedSQLQueryError from './errors/chained-sql-query-error';
import EmptySQLQueryError from './errors/empty-sql-query-error';
import NonSelectSQLQueryError from './errors/non-select-sql-query-error';

const QUERY_SELECT = /^SELECT\s[^]*FROM\s[^]*$/i;

export default function verifySQLQuery(inputQuery: string | null): boolean {
  if (!inputQuery?.trim()) {
    throw new EmptySQLQueryError();
  }

  if (inputQuery.includes(';') && inputQuery.indexOf(';') < inputQuery.length - 1) {
    throw new ChainedSQLQueryError();
  }

  if (!QUERY_SELECT.test(inputQuery)) {
    throw new NonSelectSQLQueryError();
  }

  return true;
}
