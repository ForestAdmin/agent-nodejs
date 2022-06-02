import { Collection } from '@forestadmin/agent';
import { Schema } from '../typings';

export default (collection: Collection<Schema, 'customer'>) =>
  collection
    .addOneToManyRelation('rentals', 'rental', { originKey: 'customerId' })
    .removeField('deletedAt');
// .hooks.onBeforeList(context => {
//   const { caller } = context;
//   context.addFieldToProjection('deletedAt');

//   if (caller.firstName === 'Jeff') {
//     const filter = { ...context.filter };
//     filter.sort = [{ ascending: true, field: 'firstName' }];
//   }
// })
// .hooks.onBeforeList(context => {
//   console.log('b', context.filter);
//   context.addFilteringCondition({ field: 'firstName', operator: 'IContains', value: 'o' });

//   console.log('b1', context.filter);
// })
// .hooks.onAfterList(context => {
//   console.log('a', context.filter);

//   console.log(context.records);
// });
// .hooks.onBeforeList(async (context, flow) => {
//   console.log('2');

//   flow.continue();
// })
// .hooks.onBeforeCreate(async (context, flow) => {
//   flow.error('blbl');
// });
