import { Collection } from '@forestadmin/agent';

export default (collection: Collection) =>
  collection.addManyToOne('post', 'post', { foreignKey: 'postId' });
