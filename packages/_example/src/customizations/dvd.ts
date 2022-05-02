import { Collection } from '@forestadmin/agent';
import sequelizeMsSql from '../datasources/sequelize/mssql';

export default (collection: Collection) =>
  collection
    .addRelation('store', {
      type: 'ManyToOne',
      foreignKey: 'storeId',
      foreignKeyTarget: 'id',
      foreignCollection: 'store',
    })
    .renameField('rentalPrice', 'rentalPriceInDollar')
    .addAction('Increase the rental price', {
      scope: 'Bulk',
      form: [
        {
          label: 'percentage',
          type: 'Number',
          defaultValue: 10,
          isRequired: true,
        },
      ],
      execute: async (context, responseBuilder) => {
        const { percentage } = context.formValues;

        if (percentage < 0) {
          return responseBuilder.error('Prices can only go up!');
        }

        await sequelizeMsSql.query(
          'UPDATE dvd SET rental_price = ROUND(rental_price * :multiplier, 2) WHERE id IN (:ids)',
          { replacements: { multiplier: 1 + percentage / 100, ids: await context.getRecordIds() } },
        );

        return responseBuilder.success(`Rental price increased by ${percentage}%`);
      },
    });
