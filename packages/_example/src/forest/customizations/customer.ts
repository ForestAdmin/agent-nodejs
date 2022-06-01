import { Collection } from '@forestadmin/agent';
import { Schema } from '../typings';

export default (collection: Collection<Schema, 'customer'>) =>
  collection
    .addOneToManyRelation('rentals', 'rental', { originKey: 'customerId' })
    .removeField('deletedAt')
    .hooks.onBeforeList((context, flow) => {
      const { caller } = context;

      if (caller.firstName === 'Jeff') {
        const filter = { ...context.filter };
        filter.sort = [{ ascending: true, field: 'firstName' }];
        flow.continue({ filter });
      }

      flow.continue({});
    });
// .hooks.onBeforeList(async (context, flow) => {
//   console.log('2');

//   flow.continue();
// })
// .hooks.onBeforeCreate(async (context, flow) => {
//   flow.error('blbl');
// });
