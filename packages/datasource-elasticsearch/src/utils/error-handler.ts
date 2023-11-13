import { ValidationError } from '@forestadmin/datasource-toolkit';

type Callback<T> = () => T;

export default async function handleErrors<T>(
  method: 'create' | 'update' | 'delete' | 'list',
  callback: Callback<T>,
): Promise<T> {
  try {
    const result = await callback();

    return result;
  } catch (e) {
    // const message = 'The query violates rules in the database: query malformed';

    throw new ValidationError(e.message);
  }
}
// ResponseError see https://github.com/elastic/elastic-transport-js/blob/main/src/errors.ts
