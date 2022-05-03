import { Collection } from '@forestadmin/agent';

export default (collection: Collection) =>
  collection.addRelation('post', {
    type: 'ManyToOne',
    foreignCollection: 'post',
    foreignKey: 'postId',
  });
