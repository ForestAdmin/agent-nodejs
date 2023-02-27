// This file was created by using the 'Copy as fetch' feature of the Chrome DevTools.

// Do not edit them manually! If the API changes, regenerate them by using Chrome as to ensure
// the queries match the frontend's behavior.

/* eslint-disable max-len */
import { createMockContext } from '@shopify/jest-koa-mocks';

import user from './_user';

export default createMockContext({
  method: 'DELETE',
  url: '/forest/post/96/relationships/comments?delete=true&timezone=Europe%2FParis',
  requestBody: {
    data: {
      attributes: {
        ids: [{ id: '480', type: 'comment' }],
        collection_name: 'comment',
        parent_collection_name: 'post',
        parent_collection_id: '96',
        parent_association_name: 'comments',
        all_records: true,
        all_records_subset_query: {
          'fields[comment]': 'body,email,id,name,post',
          'fields[post]': 'id',
          'page[number]': 1,
          'page[size]': 15,
          sort: '-id',
          search: 'michel',
          searchExtended: 0,
        },
        all_records_ids_excluded: [],
        smart_action_id: null,
        signed_approval_request: null,
      },
      type: 'action-requests',
    },
  },
  state: { user },
});
