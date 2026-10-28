import { ValidationError } from '@forestadmin/datasource-toolkit';

const PLACEHOLDER_START = /[A-Za-z0-9_]/;

/**
 * Replaces `$name` placeholders by `?` and lists their values in order. What sits inside a string
 * literal ('…') or a quoted identifier ("…") is text, so it is left alone.
 */
export default function parameterize(
  query: string,
  variables: Record<string, unknown>,
): { statement: string; parameters: unknown[] } {
  const parameters: unknown[] = [];
  let statement = '';
  let quote: string | undefined;

  for (let i = 0; i < query.length; i += 1) {
    const char = query[i];

    if (quote) {
      statement += char;

      if (char === quote) {
        // A doubled quote is an escaped one, not the end of the literal.
        if (query[i + 1] === quote) {
          i += 1;
          statement += quote;
        } else {
          quote = undefined;
        }
      }
    } else if (char === "'" || char === '"') {
      quote = char;
      statement += char;
    } else if (char === '$' && PLACEHOLDER_START.test(query[i + 1] ?? '')) {
      let end = i + 1;

      while (end < query.length && PLACEHOLDER_START.test(query[end])) end += 1;

      const name = query.slice(i + 1, end);

      if (!(name in variables)) {
        throw new ValidationError(`No value was given for the placeholder $${name}`);
      }

      parameters.push(variables[name]);
      statement += '?';
      i = end - 1;
    } else {
      statement += char;
    }
  }

  return { statement, parameters };
}
