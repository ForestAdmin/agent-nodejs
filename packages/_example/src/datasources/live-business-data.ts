export default async function loadExampleData(dataSource) {
  const companyRecords = [{ name: 'Forest Admin' }, { name: 'Lumber Jacks Incorporated' }];
  const userRecords = [];
  const itemRecords = [];
  const itemReferenceRecords = [];

  const companies = await dataSource.getCollection('companies').create(companyRecords);

  companies.forEach(company => {
    for (let i = 0; i < 5; i += 1) {
      const userName = `User ${i.toString().padStart(2, '0')}`;
      const domainName = company.name.replace(/ /g, '').toLowerCase();

      userRecords.push({
        name: userName,
        email: `${userName}@${domainName}.com`,
        companyId: company.id,
      });
    }
  });

  const users = await dataSource.getCollection('users').create(userRecords);

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
  });

  const itemReferences = await dataSource
    .getCollection('itemReferences')
    .create(itemReferenceRecords);

  itemReferences.forEach((itemReference, index) => {
    itemRecords[index].itemReferenceId = itemReference.id;
  });

  await dataSource.getCollection('items').create(itemRecords);
}
