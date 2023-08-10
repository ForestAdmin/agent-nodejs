import sequelizeMsSql from '../../connections/sequelize-mssql';
import { DvdCustomizer, DvdRentalAggregation, DvdRentalFilter } from '../typings';

export default (collection: DvdCustomizer) =>
  collection
    .addManyToOneRelation('store', 'store', { foreignKey: 'storeId' })
    .renameField('rentalPrice', 'rentalPriceInDollar')
    .addField('numberOfRentals', {
      columnType: 'Number',
      dependencies: ['id'],
      getValues: async (records, context) => {
        // Query other collection to get the number of rentals per dvd.
        const filter: DvdRentalFilter = {
          conditionTree: { field: 'dvdId', operator: 'In', value: records.map(r => r.id) },
        };

        const aggregation: DvdRentalAggregation = {
          operation: 'Count',
          groups: [{ field: 'dvdId' }],
        };

        const rows = await context.dataSource
          .getCollection('dvd_rental')
          .aggregate(filter, aggregation);

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
