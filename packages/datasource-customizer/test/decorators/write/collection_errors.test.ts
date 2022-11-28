import { Collection, ValidationError } from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import WriteDecorator from '../../../src/decorators/write/collection';

const caller = factories.caller.build();
const filter = factories.filter.build();

describe('WriteDecorator > Error cases', () => {
  let collection: Collection;
  let decorator: WriteDecorator;

  beforeEach(() => {
    const dataSource = factories.dataSource.buildWithCollection(
      factories.collection.build({
        name: 'books',
        schema: factories.collectionSchema.build({
          fields: {
            name: factories.columnSchema.build({ columnType: 'String' }),
            age: factories.columnSchema.build({ columnType: 'String' }),
          },
        }),
      }),
    );

    collection = dataSource.getCollection('books');
    decorator = new WriteDecorator(collection, dataSource);
  });

  it('should throw when customizing a non existant field', () => {
    expect(() => decorator.replaceFieldWriting('NOT EXIST', () => undefined)).toThrowError(
      'The given field "NOT EXIST" does not exist on the books collection.',
    );
  });

  it('should throw when the handler returns a string', async () => {
    decorator.replaceFieldWriting('age', async () => 'RETURN_SHOULD_FAIL');

    await expect(() => decorator.update(caller, filter, { age: '10' })).rejects.toThrowError(
      'The write handler of age should return an object or nothing.',
    );
  });

  it('should throw when the handler returns non existent relations', async () => {
    decorator.replaceFieldWriting('age', () => ({ author: { lastname: 'Asimov' } }));

    await expect(() => decorator.update(caller, filter, { age: '10' })).rejects.toThrowError(
      'Unknown field "author"',
    );
  });

  it('throws an error if the same handler is triggered several times', async () => {
    const nameDefinition = jest.fn().mockResolvedValue({ name: 'triggeredSecondTime' });
    decorator.replaceFieldWriting('name', nameDefinition);
    const ageDefinitionTriggerName = jest.fn().mockResolvedValue({ name: 'changed name' });
    decorator.replaceFieldWriting('age', ageDefinitionTriggerName);

    // when/then
    await expect(() =>
      decorator.update(caller, filter, { age: '10', name: 'triggeredOneTime' }),
    ).rejects.toThrow(
      new ValidationError('Conflict value on the field "name". It receives several values.'),
    );
  });

  it('should throw an error if there is a cyclic dependency', async () => {
    const nameDefinition = jest.fn().mockResolvedValue({ age: 'cyclic dependency' });
    decorator.replaceFieldWriting('name', nameDefinition);
    const ageDefinitionTriggerName = jest.fn().mockResolvedValue({ name: 'changed name' });
    decorator.replaceFieldWriting('age', ageDefinitionTriggerName);

    // when/then
    await expect(() => decorator.update(caller, filter, { age: '10' })).rejects.toThrow(
      new ValidationError('There is a cyclic dependency on the "age" column.'),
    );
  });
});
