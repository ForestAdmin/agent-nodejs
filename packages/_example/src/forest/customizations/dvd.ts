import type { DvdCustomizer } from '../typings';

import sequelizeMsSql from '../../connections/sequelize-mssql';

export default (collection: DvdCustomizer) =>
  collection
    .addManyToOneRelation('store', 'store', { foreignKey: 'storeId' })
    .renameField('rentalPrice', 'rentalPriceInDollar')
    .addField('numberOfRentals', {
      columnType: 'Number',
      dependencies: ['id'],
      getValues: async (records, context) => {
        const rows = await context.collection.nativeDriver.rawQuery(
          'SELECT dvd_id, COUNT(*) AS count FROM dvd_rental WHERE dvd_id IN (:ids) GROUP BY dvd_id',
          { ids: records.map(r => r.id) },
        );

        // getValues should return values in the same order than the initial `records` array.
        return records.map(record => rows.find(r => r.dvd_id === record.id)?.count ?? 0);
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
