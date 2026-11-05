/** People: their full name. */
export default function customizeIndividuals(collection) {
  collection.addField('full_name', {
    columnType: 'String',
    dependencies: ['first_name', 'last_name'],
    getValues: records => records.map(r => `${r.first_name} ${r.last_name}`),
  });
}
