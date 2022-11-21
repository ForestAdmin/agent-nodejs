import { CollectionCustomizer } from '@forestadmin/agent';

import { Schema } from '../typings';

export default (collection: CollectionCustomizer<Schema, 'comment'>) =>
  collection.addManyToOneRelation('post', 'post', { foreignKey: 'postId' });
