/* eslint-disable */
import { Caller, Filter, Projection } from '@forestadmin/datasource-toolkit';

import { createHubspotDataSource } from '.';

// test datasource
async function main() {
  const factory = createHubspotDataSource({
    accessToken: 'pat-eu1-66a46b51-feaa-4b5a-ab11-0fe79a288935',
    collections: { contacts: ['firstname', 'lastname', 'mycustomfield'] },
  });

  const dataSource = await factory(console.log);
  const caller = {} as Caller;
  const filter = new Filter({});
  const projection = new Projection('id', 'firstname', 'lastname', 'mycustomfield');

  const records = await dataSource
    .getCollection('hubspot_contacts')
    .list(caller, filter, projection);

  console.log(records);
}

main();
