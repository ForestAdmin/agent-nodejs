export default async function loadExampleData(dataSource) {
  const companyRecords = [{ name: 'Forest Admin' }, { name: 'Lumber Jacks Incorporated' }];
  const syndicateRecords = [{ name: 'Tree Saviours' }, { name: 'Hatchet Lovers' }];
  const userRecords = [];
  const itemRecords = [];
  const itemReferenceRecords = [];
  const userSyndicateRecords = [];

  const companies = await dataSource.getCollection('companie').create(companyRecords);

  companies.forEach(company => {
    for (let i = 0; i < 5; i += 1) {
      const userName = `User ${i.toString().padStart(2, '0')} (${company.name})`;
      const domainName = company.name.replace(/ /g, '').toLowerCase();

      userRecords.push({
        name: userName,
        email: `${userName}@${domainName}.com`,
        companyId: company.id,
      });
    }
  });

  const syndicates = await dataSource.getCollection('syndicate').create(syndicateRecords);

  const users = await dataSource.getCollection('user').create(userRecords);

  users.forEach(user => {
    for (let i = 0; i < 5; i += 1) {
      const itemName = `Item ${i.toString().padStart(2, '0')} for ${user.name}`;

      itemReferenceRecords.push({
        reference: `ref-${i.toString().padStart(3, '0')}-${user.name}`,
      });

      itemRecords.push({
        name: itemName,
        value: 9000 + user.id * 10 + i,
        userId: user.id,
      });
    }

    userSyndicateRecords.push({
      userId: user.id,
      syndicateId: syndicates[user.id % 2].id,
      rating: (user.id + (user.id % 2)) % 3,
    });
  });

  await dataSource.getCollection('userSyndicate').create(userSyndicateRecords);

  const itemReferences = await dataSource
    .getCollection('itemReference')
    .create(itemReferenceRecords);

  itemReferences.forEach((itemReference, index) => {
    itemRecords[index].itemReferenceId = itemReference.id;
  });

  await dataSource.getCollection('item').create(itemRecords);
}
