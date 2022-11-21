import { ValidationError } from '@forestadmin/datasource-toolkit';
import { ForeignKeyConstraintError, UniqueConstraintError } from 'sequelize';

type Callback<T> = () => T;

export default async function handleErrors<T>(
  method: 'create' | 'update' | 'delete',
  callback: Callback<T>,
): Promise<T> {
  try {
    const result = await callback();

    return result;
  } catch (e) {
    if (e instanceof UniqueConstraintError) {
      const message =
        'The query violates a unicity constraint in the database. ' +
        'Please ensure that you are not duplicating information across records.';

      throw new ValidationError(message);
    }

    if (e instanceof ForeignKeyConstraintError) {
      let message = 'The query violates a foreign key constraint in the database. ';

      if (method === 'create' || method === 'update') {
        message += 'Please ensure that you are not linking to a relation which was deleted.';
      } else {
        message += 'Please ensure that no records are linked to the one that you wish to delete.';
      }

      throw new ValidationError(message);
    }

    throw e;
  }
}
