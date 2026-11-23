import type { IndividualsCustomizer } from '../typings';

const NAME_MAX_LENGTH = 50;

export default (collection: IndividualsCustomizer) =>
  collection
    .addFieldValidation('first_name', 'Present')
    .addFieldValidation('first_name', 'LongerThan', 1)
    .addFieldValidation('first_name', 'ShorterThan', NAME_MAX_LENGTH)
    .addFieldValidation('last_name', 'ShorterThan', NAME_MAX_LENGTH)
    .addFieldValidation('email', 'Contains', '@')

    .addField('full_name', {
      columnType: 'String',
      dependencies: ['first_name', 'last_name'],
      getValues: records => records.map(record => `${record.first_name} ${record.last_name}`),
    })
    .replaceFieldWriting('full_name', fullName => {
      const [firstName, ...lastNames] = (fullName as string).split(' ');

      return { first_name: firstName, last_name: lastNames.join(' ') };
    })
    .replaceFieldSorting('full_name', [
      { field: 'first_name', ascending: true },
      { field: 'last_name', ascending: true },
    ]);
