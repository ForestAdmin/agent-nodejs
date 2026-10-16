import type { AuditRecord } from './types';

import { Sequelize } from 'sequelize';

import { REDACTED } from './instrument';

// The `fields` and `search` filters, matched in SQL by the store and on the values as served by a
// route that withholds some of them. Both read the columns below, so they cannot drift apart.
const IDENTITY_COLUMNS = [
  ['actionName', 'action_name'],
  ['userFirstName', 'user_first_name'],
  ['userLastName', 'user_last_name'],
  ['userEmail', 'user_email'],
] as const;

const VALUE_COLUMNS = [
  ['previousValues', 'previous_values'],
  ['newValues', 'new_values'],
] as const;

// A bare `$.${field}` path treats a dot in `field` as a nested-member separator instead of a
// literal character (so `profile.name` would look up `profile` → `name` instead of the top-level
// key `"profile.name"` the audit row actually stores under). Quoting the segment makes it literal.
function jsonPath(field: string): string {
  return `$."${field.replace(/"/g, '\\"')}"`;
}

export function fieldsChangedCondition(sequelize: Sequelize, fields: string[]) {
  const dialect = sequelize.getDialect();

  if (dialect === 'postgres') {
    const keys = fields.map(field => sequelize.escape(field)).join(',');

    return Sequelize.literal(
      `(jsonb_exists_any("previous_values"::jsonb, ARRAY[${keys}]) ` +
        `OR jsonb_exists_any("new_values"::jsonb, ARRAY[${keys}]))`,
    );
  }

  if (dialect === 'sqlite') {
    const tests = fields.flatMap(field => {
      const path = sequelize.escape(jsonPath(field));

      return [
        `json_type(previous_values, ${path}) IS NOT NULL`,
        `json_type(new_values, ${path}) IS NOT NULL`,
      ];
    });

    return Sequelize.literal(`(${tests.join(' OR ')})`);
  }

  if (dialect === 'mysql' || dialect === 'mariadb') {
    const paths = fields.map(field => sequelize.escape(jsonPath(field))).join(',');

    return Sequelize.literal(
      `(JSON_CONTAINS_PATH(previous_values, 'one', ${paths}) ` +
        `OR JSON_CONTAINS_PATH(new_values, 'one', ${paths}))`,
    );
  }

  if (dialect === 'mssql') {
    const tests = fields.flatMap(field => {
      const path = sequelize.escape(jsonPath(field));

      return [
        `JSON_PATH_EXISTS(previous_values, ${path}) = 1`,
        `JSON_PATH_EXISTS(new_values, ${path}) = 1`,
      ];
    });

    // JSON_PATH_EXISTS requires SQL Server 2022+.
    return Sequelize.literal(`(${tests.join(' OR ')})`);
  }

  throw new Error(`Audit-trail "fields" filter is not supported on dialect "${dialect}"`);
}

// JSON columns are already stored as plain text on dialects with no native JSON type (sqlite,
// mssql); only postgres/mysql/mariadb need an explicit cast before a text match can run on them.
function jsonColumnAsText(sequelize: Sequelize, column: string): string {
  const dialect = sequelize.getDialect();

  if (dialect === 'postgres') return `${column}::text`;
  if (dialect === 'mysql' || dialect === 'mariadb') return `CAST(${column} AS CHAR)`;

  return column;
}

// What serializing the term would have produced, minus its own surrounding quotes.
export function jsonEscaped(term: string): string {
  return JSON.stringify(term).slice(1, -1);
}

// A free-text search against the *serialized* JSON text naturally covers "keys and scalar values
// at any depth" without walking the structure by hand: both a key and a value appear as a quoted
// literal substring of that text. This runs as a SQL WHERE clause (not an in-memory scan of
// fetched rows), so it composes with pagination and COUNT the same way every other filter does.
//
// Two things keep it honest about what the text holds. The term is escaped the way JSON wrote the
// values, so `15" monitor` (stored as `15\" monitor`) is found, and a bare quote can't match the
// document's own structure. And the redaction mask is removed before matching, so `search=redacted`
// can't confirm which rows hold a masked value. Both mirror agent-ruby's `Sql::TextSearch`.
export function searchCondition(sequelize: Sequelize, term: string) {
  // `~` rather than the standard `\`: MySQL/MariaDB treat backslash as a string-literal escape
  // character under the default sql_mode (no NO_BACKSLASH_ESCAPES), so a bare `ESCAPE '\'` is
  // itself malformed there — the backslash escapes the closing quote instead of terminating the
  // literal. `~` has no special meaning to any of the four supported dialects' string literals, so
  // it sidesteps that interaction entirely. Escapes the two LIKE wildcards plus itself, so a term
  // containing `%`/`_`/`~` is matched literally instead of behaving like a pattern.
  const like = (expression: string, text: string) => {
    const escaped = text.replace(/[~%_]/g, char => `~${char}`);

    return `LOWER(${expression}) LIKE LOWER(${sequelize.escape(`%${escaped}%`)}) ESCAPE '~'`;
  };

  const valuesAsText = (column: string) =>
    `REPLACE(${jsonColumnAsText(sequelize, column)}, ${sequelize.escape(REDACTED)}, '')`;

  const clauses = [
    ...IDENTITY_COLUMNS.map(([, column]) => like(column, term)),
    ...VALUE_COLUMNS.map(([, column]) => like(valuesAsText(column), jsonEscaped(term))),
  ];

  return Sequelize.literal(`(${clauses.join(' OR ')})`);
}

/** `fieldsChangedCondition` and `searchCondition`, run on the values as served. */
export function matchesServedValues(
  entry: AuditRecord,
  { fields, search }: { fields?: string[]; search?: string },
): boolean {
  const sides = VALUE_COLUMNS.map(([attribute]) => entry[attribute] ?? {});
  const touchesField =
    !fields ||
    sides.some(values => fields.some(field => Object.prototype.hasOwnProperty.call(values, field)));

  if (!touchesField) return false;
  if (!search) return true;

  const term = search.toLowerCase();
  const valueTerm = jsonEscaped(term);

  return (
    IDENTITY_COLUMNS.some(([attribute]) => entry[attribute]?.toLowerCase().includes(term)) ||
    sides.some(values =>
      JSON.stringify(values).split(REDACTED).join('').toLowerCase().includes(valueTerm),
    )
  );
}
