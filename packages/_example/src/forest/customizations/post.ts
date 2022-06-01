import { Collection } from '@forestadmin/agent';
import { Schema } from '../typings';

export default (collection: Collection<Schema, 'post'>) =>
  collection
    .addOneToManyRelation('comments', 'comment', { originKey: 'postId' })
    .addManyToOneRelation('owner', 'owner', { foreignKey: 'userId' });
