import { COLLECTIONS_WITH_MANY_TO_MANY_RELATIONS } from './constants';

export function buildManyToManyNames(availableCollections: string[]): string[] {
  const relationsToBuild = COLLECTIONS_WITH_MANY_TO_MANY_RELATIONS.filter(collectionName =>
    availableCollections.includes(collectionName),
  );

  return relationsToBuild.reduce((relations, fromCollectionName, index) => {
    for (let i = index + 1; i < relationsToBuild.length; i += 1) {
      relations.push(`${fromCollectionName}_${relationsToBuild[i]}`);
    }

    return relations;
  }, []);
}

export function getRelationsOf(collectionName: string, availableCollections: string[]): string[] {
  return COLLECTIONS_WITH_MANY_TO_MANY_RELATIONS.filter(r =>
    availableCollections.includes(r),
  ).filter(r => !r.includes(collectionName));
}

export function getRelationsByCollection(availableCollections: string[]): {
  [collectionName: string]: string[];
} {
  return availableCollections.reduce((relations, collectionName) => {
    relations[collectionName] = getRelationsOf(collectionName, availableCollections);

    return relations;
  }, {});
}
