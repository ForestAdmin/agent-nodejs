import http from 'http';

import { ForestAdminHttpDriverOptions, AgentBuilder } from '@forestadmin/agent';

import {
  Aggregation,
  AggregationOperation,
  ConditionTreeFactory,
  ConditionTreeLeaf,
  Operator,
  PaginatedFilter,
  PrimitiveTypes,
  Projection,
} from '@forestadmin/datasource-toolkit';
import prepareDummyDataSource from './datasources/dummy-library';

export default async function start(
  serverPort: number,
  serverHost: string,
  options: ForestAdminHttpDriverOptions,
) {
  const builder = new AgentBuilder(options);

  builder
    .addDatasource(await prepareDummyDataSource())
    .build()
    .collection('books', booksCollection => {
      return booksCollection.renameField('publication', 'publishedAt');
    })
    .collection('persons', personsCollection => {
      // return personsCollection;
      return personsCollection
        .registerComputed('fullName', {
          columnType: PrimitiveTypes.String,
          dependencies: new Projection('firstName', 'lastName'),
          getValues: records => records.map(record => `${record.firstName} ${record.lastName}`),
        })
        .emulateSort('fullName')
        .emulateStringOperators('fullName')
        .registerComputed('fullNameCapitalize', {
          columnType: PrimitiveTypes.String,
          dependencies: new Projection('fullName'),
          getValues: records => records.map(record => (record.fullName as string).toUpperCase()),
        })
        .unpublishFields(['firstName', 'lastName'])
        .registerComputed('booksCount', {
          columnType: PrimitiveTypes.Number,
          dependencies: new Projection('id'),
          getValues: async (persons, { dataSource }) => {
            const counts = await dataSource.getCollection('books').aggregate(
              new PaginatedFilter({
                conditionTree: new ConditionTreeLeaf(
                  'author:id',
                  Operator.In,
                  persons.map(p => p.id),
                ),
              }),
              new Aggregation({
                operation: AggregationOperation.Count,
                groups: [{ field: 'author:id' }],
              }),
            );

            return persons.map(person => {
              const count = counts.find(c => c.group['author:id'] === person.id);

              return count?.value ?? 0;
            });
          },
        });
    })
    .start();

  const server = http.createServer(builder.httpCallback);

  await new Promise<void>(resolve => {
    server.listen(serverPort, serverHost, null, () => {
      resolve();
    });
  });

  return () => {
    server.close();
  };
}
