import { AccountCustomizer } from '../typings';

export default (collection: AccountCustomizer) =>
  collection.addManyToOneRelation('store', 'store', { foreignKey: 'storeId' }).addAction('test', {
    scope: 'Global',
    form: [
      {
        label: 'change',
        type: 'String',
      },
      {
        label: 'to change',
        type: 'String',
        isReadOnly: true,
        value: context => {
          if (context.changedField === 'change') {
            return context.formValues.change;
          }
        },
      },
    ],
    execute: () => {},
  });
