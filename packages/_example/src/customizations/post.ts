import { Collection } from '@forestadmin/agent';

export default (collection: Collection) =>
  collection
    .addOneToMany('comments', 'comment', { originKey: 'postId' })
    .addManyToOne('owner', 'owner', { foreignKey: 'userId' });
