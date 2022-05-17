import { Collection } from '@forestadmin/agent';
import { Schema } from '../typings';

export default (collection: Collection<Schema, 'comment'>) =>
  collection.addManyToOne('post', 'post', { foreignKey: 'postId' });
