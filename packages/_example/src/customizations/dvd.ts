import { Collection } from '@forestadmin/agent';
import { ConditionTreeLeaf, Filter, Projection } from '@forestadmin/datasource-toolkit';

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
      execute: async (context, responseBuilder) => {
        const records = await context.collection.list(
          context.filter,
          new Projection('rentalPrice', 'id'),
        );

        // increase the rental price by a given a percentage
        const givenPercentage = context.formValues.percentage / 100;
        const updates = records.map(
          (record: { id: string; rentalPrice: number }): Promise<void> =>
            context.collection.update(
              new Filter({
                conditionTree: new ConditionTreeLeaf('id', 'Equal', record.id),
              }),
              { rentalPrice: record.rentalPrice + record.rentalPrice * givenPercentage },
            ),
        );
        await Promise.all(updates);

        return responseBuilder.success('Rental price is updated');
      },
      form: [
        {
          label: 'percentage',
          type: 'Number',
          defaultValue: 10,
          isRequired: true,
        },
      ],
    });
