import { COLLECTIONS_WITH_MANY_TO_MANY_RELATIONS } from './constants';

// eslint-disable-next-line import/prefer-default-export
export function getRelationNames(collections: string[]): string[] {
  const relationsToBuild = COLLECTIONS_WITH_MANY_TO_MANY_RELATIONS.filter(collectionName =>
    collections.includes(collectionName),
  );

  return relationsToBuild.reduce((relations, fromCollectionName, index) => {
    for (let i = index + 1; i < relationsToBuild.length; i += 1) {
      relations.push(`${fromCollectionName}_${relationsToBuild[i]}`);
    }

    return relations;
  }, []);
}

export function getRelationsByCollection(collections: string[]): {
  [collectionName: string]: string[];
} {
  const manyToManyRelations = getRelationNames(collections);

  return collections.reduce((relations, collectionName) => {
    const filtered = manyToManyRelations.filter(relationName =>
      relationName.startsWith(collectionName),
    );
    relations[collectionName] = filtered.map(relationName => relationName.split('_')[1]);

    return relations;
  }, {});
}

export function getRelationsOf(collectionName: string): string[] {
  return COLLECTIONS_WITH_MANY_TO_MANY_RELATIONS.filter(
    relationName => !relationName.includes(collectionName),
  );
}
