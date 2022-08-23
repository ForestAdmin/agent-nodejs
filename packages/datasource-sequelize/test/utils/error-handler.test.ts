import { ForeignKeyConstraintError, UniqueConstraintError } from 'sequelize';
import { ValidationError } from '@forestadmin/datasource-toolkit';
import handleErrors from '../../src/utils/error-handler';

describe('Utils > handleErrors', () => {
  it('should proxy the function when no errors occur', async () => {
    const result = await handleErrors('create', () => 'something');

    expect(result).toStrictEqual('something');
  });

  it('should convert foreign key errors for creations', async () => {
    const fn = () =>
      handleErrors('create', () => {
        throw new ForeignKeyConstraintError({});
      });

    await expect(fn).rejects.toThrow(ValidationError);
    await expect(fn).rejects.toThrow(
      'Please ensure that you are not linking to a relation which was deleted.',
    );
  });

  it('should convert foreign key errors for deletion', async () => {
    const fn = () =>
      handleErrors('delete', () => {
        throw new ForeignKeyConstraintError({});
      });

    await expect(fn).rejects.toThrow(ValidationError);
    await expect(fn).rejects.toThrow(
      'Please ensure that no records are linked to the one that you wish to delete.',
    );
  });

  it('should convert unicity errors', async () => {
    const fn = () =>
      handleErrors('delete', () => {
        throw new UniqueConstraintError({});
      });

    await expect(fn).rejects.toThrow(ValidationError);
    await expect(fn).rejects.toThrow(
      'Please ensure that you are not duplicating information across records.',
    );
  });

  it('should rethrow other errors', async () => {
    const error = new Error('');
    const fn = () =>
      handleErrors('delete', () => {
        throw error;
      });

    await expect(fn).rejects.toThrow(error);
  });
});
