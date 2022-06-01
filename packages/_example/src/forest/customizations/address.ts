import { Collection } from '@forestadmin/agent';
import { Schema } from '../typings';

export default (collection: Collection<Schema, 'address'>) =>
  collection
    .addManyToOneRelation('store', 'store', { foreignKey: 'storeId' })
    .addExternalRelation('nearStates', {
      schema: { code: 'Number', name: 'String' },
      dependencies: ['zipCode'],
      listRecords: ({ zipCode }) =>
        zipCode.charAt(0) < '5'
          ? [
              { code: 'AL', name: 'Alabama' },
              { code: 'AK', name: 'Alaska' },
              { code: 'AZ', name: 'Arizona' },
            ]
          : [
              { code: 'CT', name: 'Connecticut' },
              { code: 'DE', name: 'Delaware' },
              { code: 'FL', name: 'Florida' },
            ],
    })

    .removeField('updatedAt', 'createdAt')
    .replaceSearch(value => ({
      aggregator: 'Or',
      conditions: [
        { field: 'address', operator: 'Contains', value },
        { field: 'store:name', operator: 'Contains', value },
      ],
    }));
