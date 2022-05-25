/* eslint-disable max-classes-per-file */
import { DataSourceFactory } from '@forestadmin/datasource-toolkit';
import { createCachedDataSource } from '@forestadmin/datasource-live';
import superagent, { SuperAgentRequest } from 'superagent';

async function getNewRecords(collection: string, cursor: string, limit: number) {
  let request: SuperAgentRequest;
  request = superagent.get(`https://jsonplaceholder.typicode.com/${collection}`);
  request = request.query({ _sort: 'id', _order: 'asc', _limit: limit });

  if (cursor) {
    request = request.query({ id_gte: cursor, id_ne: cursor });
  }

  const response = await request.send();

  return response.body;
}

export default function createTypicodeCached(): DataSourceFactory {
  return createCachedDataSource(
    {
      post: {
        id: { isPrimaryKey: true, type: 'Column', columnType: 'Number' },
        userId: { type: 'Column', columnType: 'Number' },
        title: { type: 'Column', columnType: 'String' },
        body: { type: 'Column', columnType: 'String' },
      },
      comment: {
        id: { isPrimaryKey: true, type: 'Column', columnType: 'Number' },
        postId: { type: 'Column', columnType: 'Number' },
        name: { type: 'Column', columnType: 'String' },
        email: { type: 'Column', columnType: 'String' },
        body: { type: 'Column', columnType: 'String' },
        post: {
          type: 'ManyToOne',
          foreignCollection: 'post',
          foreignKey: 'postId',
          foreignKeyTarget: 'id',
        },
      },
    },
    {
      listChanges: async cursor => {
        const limit = 100;
        const [posts, comments] = await Promise.all([
          getNewRecords('posts', cursor?.postId, limit),
          getNewRecords('comments', cursor?.commentId, limit),
        ]);

        return {
          done: posts.length < limit && comments.length < limit,
          nextCursor: {
            postId: posts.length ? posts[posts.length - 1].id : cursor?.postId,
            commentId: comments.length ? comments[comments.length - 1].id : cursor?.commentId,
          },
          changes: {
            post: { creations: posts, updates: [], deletions: [] },
            comment: { creations: comments, updates: [], deletions: [] },
          },
        };
      },
    },
  );
}
