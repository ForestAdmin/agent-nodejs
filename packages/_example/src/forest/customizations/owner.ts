import { CollectionCustomizer } from '@forestadmin/agent';

import { Schema } from '../typings';

export default (collection: CollectionCustomizer<Schema, 'owner'>) =>
  collection
    .addOneToManyRelation('stores', 'store', { originKey: 'ownerId' })
    .addOneToManyRelation('posts', 'post', { originKey: 'userId' })

    .customizeField('fullName', field =>
      field
        .add({
          columnType: 'String',
          dependencies: ['firstName', 'lastName'],
          getValues: records => records.map(record => `${record.firstName} ${record.lastName}`),
        })
        .replaceWriting(fullName => {
          const [firstName, lastName] = (fullName as string).split(' ');

          return { firstName, lastName };
        })
        .replaceSorting([
          { field: 'firstName', ascending: true },
          { field: 'lastName', ascending: true },
        ]),
    );
