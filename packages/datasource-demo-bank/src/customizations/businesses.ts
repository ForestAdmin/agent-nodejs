/** Companies: in the register, not all of them bank here (holdings own customers). */
export default function customizeBusinesses(collection) {
  collection.addField('bank_relationship', {
    columnType: 'String',
    dependencies: ['customer:id'],
    getValues: records =>
      records.map(r => (r.customer?.id ? 'Customer' : 'Holding, not a customer')),
  });
}
