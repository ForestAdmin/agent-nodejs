/* eslint-disable no-console */

import { AgentBuilder, ForestAdminHttpDriverOptions } from '@forestadmin/agent';
import { DummyDataSource } from '@forestadmin/datasource-dummy';
import { PrimitiveTypes, Projection } from '@forestadmin/datasource-toolkit';
import http from 'http';

export default async function start(
  serverPort: number,
  serverHost: string,
  options: ForestAdminHttpDriverOptions,
) {
  const agentBuilder = new AgentBuilder(options);
  const dummyDatasource = new DummyDataSource();

  await agentBuilder
    .addDatasource(dummyDatasource)
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
    })
    .start();

  const server = http.createServer(agentBuilder.httpCallback);

  await new Promise<void>(resolve => {
    server.listen(serverPort, serverHost, null, () => {
      resolve();
    });
  });

  return () => {
    server.close();
  };
}
