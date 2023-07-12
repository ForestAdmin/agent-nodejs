import { COLLECTIONS_WITH_MANY_TO_MANY_RELATIONS } from './constants';

// eslint-disable-next-line import/prefer-default-export
export function getManyToManyRelationNames(collections: string[]): string[] {
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
