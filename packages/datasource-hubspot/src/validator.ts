import { FieldPropertiesByCollection } from './types';

export default function validateCollectionsProperties<TypingsHubspot>(
  propertiesFromUser: FieldPropertiesByCollection | TypingsHubspot,
  properties: FieldPropertiesByCollection,
) {
  if (Object.keys(propertiesFromUser).length === 0) {
    throw new Error(`No collection has been configured. Please check your configuration.`);
  }

  Object.keys(propertiesFromUser).forEach(collectionName => {
    const collectionProperties = properties[collectionName];

    if (!collectionProperties) {
      throw new Error(
        `Collection ${collectionName} does not exist. Please check your configuration.`,
      );
    }

    if (propertiesFromUser[collectionName].length === 0) {
      throw new Error(
        `Collection ${collectionName} has no properties. Please check your configuration.`,
      );
    }
  });
}
