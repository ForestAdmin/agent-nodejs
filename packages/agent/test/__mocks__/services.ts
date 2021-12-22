import { ForestAdminHttpDriverServices } from '../../src/types';

export const serializerSerialize = jest.fn();
export const serializerDeserialize = jest.fn();

export default {
  serializer: {
    serialize: serializerSerialize,
    deserialize: serializerDeserialize,
  },
} as unknown as ForestAdminHttpDriverServices;
