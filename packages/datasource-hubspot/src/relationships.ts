import { MANY_TO_MANY_SEPARATOR } from './constants';

export function getCollectionNames(relationName: string): string[] {
  return relationName.split(MANY_TO_MANY_SEPARATOR);
}

export function buildManyToManyNames(availableCollections: string[]): string[] {
  // sort by name to be deterministic and keep the same order
  const sorted = availableCollections.sort((a, b) => a.localeCompare(b));

  return sorted.reduce((relations, fromCollectionName, index) => {
    for (let i = index + 1; i < sorted.length; i += 1) {
      relations.push(`${fromCollectionName}${MANY_TO_MANY_SEPARATOR}${sorted[i]}`);
    }

    return relations;
  }, []);
}

export function getRelatedManyToManyNames(
  collectionName: string,
  availableCollections: string[],
): string[] {
  return buildManyToManyNames(availableCollections).filter(r => r.includes(collectionName));
}

export function getRelationsOf(collectionName: string, availableCollections: string[]): string[] {
  return availableCollections.filter(r => !r.includes(collectionName));
}

export function getRelationsByCollection(availableCollections: string[]): {
  [collectionName: string]: string[];
} {
  return availableCollections.reduce((relations, collectionName) => {
    relations[collectionName] = getRelationsOf(collectionName, availableCollections);

    return relations;
  }, {});
}
