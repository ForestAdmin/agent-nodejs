/**
 * The links between tables, from the data model (model/schema.json): SQLite keeps foreign keys but
 * no relations, so every table gets its many-to-one, one-to-one, one-to-many and many-to-many
 * links here, with the names model/schema.js gives them.
 */
const { relationNames } = require('../../model/schema');

function addLinks(customizer) {
  const byTable = {};
  relationNames().forEach(link => {
    byTable[link.table] = byTable[link.table] || [];
    byTable[link.table].push(link);
  });

  Object.entries(byTable).forEach(([table, links]) =>
    customizer.customizeCollection(table, collection =>
      links.forEach(link => {
        if (link.kind === 'ManyToOne') {
          collection.addManyToOneRelation(link.name, link.target, { foreignKey: link.foreignKey });
        } else if (link.kind === 'OneToOne') {
          collection.addOneToOneRelation(link.name, link.target, { originKey: link.originKey });
        } else if (link.kind === 'OneToMany') {
          collection.addOneToManyRelation(link.name, link.target, { originKey: link.originKey });
        } else {
          collection.addManyToManyRelation(link.name, link.target, link.through, {
            originKey: link.originKey,
            foreignKey: link.foreignKey,
          });
        }
      }),
    ),
  );
}

module.exports = { addLinks };
