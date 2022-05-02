import { Collection } from '@forestadmin/agent';

export default (collection: Collection) =>
  collection
    .addRelation('comments', {
      type: 'OneToMany',
      foreignCollection: 'comment',
      originKey: 'postId',
    })
    .addRelation('owner', {
      type: 'ManyToOne',
      foreignCollection: 'owner',
      foreignKey: 'userId',
    });
