import { Collection } from '@forestadmin/agent';
import { Schema } from '../typings';

export default (collection: Collection<Schema, 'comment'>) =>
  collection.addManyToOneRelation('post', 'post', { foreignKey: 'postId' });
