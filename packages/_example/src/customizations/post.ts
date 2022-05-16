import { Collection } from '@forestadmin/agent';
import { Schema } from '../typings';

export default (collection: Collection<Schema, 'post'>) =>
  collection
    .addOneToMany('comments', 'comment', { originKey: 'postId' })
    .addManyToOne('owner', 'owner', { foreignKey: 'userId' });
