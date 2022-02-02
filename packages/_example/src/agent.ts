import { AgentBuilder, ForestAdminHttpDriverOptions } from '@forestadmin/agent';
import { DummyDataSource } from '@forestadmin/datasource-dummy';
import { PrimitiveTypes, Projection } from '@forestadmin/datasource-toolkit';

export default function makeAgent(options: ForestAdminHttpDriverOptions): AgentBuilder {
  return new AgentBuilder(options)
    .addDatasource(new DummyDataSource())
    .build()
    .collection('books', collection => {
      collection.renameField('title', 'referenceTitle').renameField('publication', 'publishedAt');
    })
    .collection('persons', collection => {
      collection
        .registerComputed('fullName', {
          dependencies: new Projection('firstName', 'lastName'),
          columnType: PrimitiveTypes.String,
          getValues: records => records.map(record => `${record.firstName} ${record.lastName}`),
        })
        .emulateSort('fullName');
    });
}
