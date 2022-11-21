import { CollectionCustomizer } from '@forestadmin/agent';

import sequelizeMsSql from '../../connections/sequelize-mssql';
import { Schema } from '../typings';

export default (collection: CollectionCustomizer<Schema, 'dvd'>) =>
  collection
    .addManyToOneRelation('store', 'store', { foreignKey: 'storeId' })
    .renameField('rentalPrice', 'rentalPriceInDollar')
    .addField('numberOfRentals', {
      columnType: 'Number',
      dependencies: ['id'],
      getValues: async (records, context) => {
        // Query other collection to get the number of rentals per dvd.
        const throughCollection = context.dataSource.getCollection('dvd_rental');
        const rows = await throughCollection.aggregate(
          { conditionTree: { field: 'dvdId', operator: 'In', value: records.map(r => r.id) } },
          { operation: 'Count', groups: [{ field: 'dvdId' }] },
        );

        // getValues should return values in the same order than the initial `records` array.
        return records.map(record => rows.find(r => r.group.dvdId === record.id)?.value ?? 0);
      },
    })
    .addAction('Increase the rental price', {
      scope: 'Bulk',
      form: [{ label: 'percentage', type: 'Number', defaultValue: 10, isRequired: true }],
      execute: async (context, resultBuilder) => {
        // Increase prices
        const replacements = {
          multiplier: 1 + context.formValues.percentage / 100,
          ids: await context.getRecordIds(),
        };

        await sequelizeMsSql.query(
          'UPDATE dvd SET rental_price = ROUND(rental_price * :multiplier, 2) WHERE id IN (:ids)',
          { replacements },
        );

        // Customize success message.
        return resultBuilder.success(`Rental price increased`);
      },
    });
