import sequelizeMsSql from '../../connections/sequelize-mssql';
import { DvdCustomizer } from '../typings';

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
    .addAction('file aa', {
      scope: 'Global',
      form: [
        {
          label: 'SwitchNextFileInput',
          type: 'Boolean',
          defaultValue: false,
        },
        {
          label: 'File1WithIf',
          description: 'Please upload a file',
          type: 'File',
          widget: 'FilePicker',
          maxSizeMb: 15,
          isRequired: true,
          if: async context => {
            if (context.hasFieldChanged('SwitchNextFileInput')) {
              return Boolean(context.formValues.SwitchNextFileInput);
            }
          },
        },
        {
          label: 'SwitchNextFileInput2',
          type: 'Boolean',
          defaultValue: true,
        },
        {
          label: 'cuicui',
          description: 'jpeg, jpg, png or pdf file, no more than 15mb',
          widget: 'FilePicker',
          maxSizeMb: 15,
          type: 'File',
          isRequired: true,
          if: context => {
            return Boolean(context.formValues.SwitchNextFileInput2);
          },
        },
      ],
      execute: (context, resultBuilder) => {
        console.log(`🚀  \x1b[45m%s\x1b[0m`, ` - context.formValues:`, context.formValues);

        return resultBuilder.success('Bravo');
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
