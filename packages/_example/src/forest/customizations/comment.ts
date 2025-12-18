import type { CommentCustomizer } from '../typings';

export default (collection: CommentCustomizer) =>
  collection.addManyToOneRelation('post', 'post', { foreignKey: 'postId' });
