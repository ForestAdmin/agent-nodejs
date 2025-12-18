import type { PostCustomizer } from '../typings';

export default (collection: PostCustomizer) =>
  collection
    .addOneToManyRelation('comments', 'comment', { originKey: 'postId' })
    .addManyToOneRelation('owner', 'owner', { foreignKey: 'userId' });
