import { CardCustomizer } from '../typings';

const products = Array.from(Array(10).keys()).map(key => ({
  name: `${key.toString()}naming`,
  id: key.toString(),
  description: `${key.toString()}tasat`,
}));

export default (collection: CardCustomizer) =>
  collection
    .addManyToOneRelation('customer', 'customer', { foreignKey: 'customer_id' })
    .addAction('Add more products', {
      scope: 'Bulk',
      form: [
        {
          label: 'Opening time',
          type: 'Time',
          widget: 'TimePicker',
        },
        {
          label: 'Openi',
          type: 'Time',
          widget: 'TimePicker',
        },
      ],
      execute: context => {
        const b = context.formValues['Opening time'];
        console.log(`🚀  \x1b[45m%s\x1b[0m`, ` - b:`, b);
        const r = b;
      },
    });
