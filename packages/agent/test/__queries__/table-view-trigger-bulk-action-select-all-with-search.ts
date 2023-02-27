// This file was created by using the 'Copy as fetch' feature of the Chrome DevTools.

// Do not edit them manually! If the API changes, regenerate them by using Chrome as to ensure
// the queries match the frontend's behavior.

/* eslint-disable max-len */
import { createMockContext } from '@shopify/jest-koa-mocks';

import user from './_user';

export default createMockContext({
  method: 'GET',
  url: '/forest/_actions/comment/1/bulk?timezone=Europe%2FParis',
  requestBody: {
    data: {
      attributes: {
        values: {},
        ids: ['500', '478', '468'],
        collection_name: 'comment',
        parent_collection_name: null,
        parent_collection_id: null,
        parent_association_name: null,
        all_records: true,
        all_records_subset_query: {
          'fields[comment]': 'body,email,id,name,post',
          'fields[post]': 'id',
          'page[number]': 1,
          'page[size]': 15,
          sort: '-id',
          search: 'emma',
          searchExtended: 0,
          isSearchExtended: false,
          timezone: 'Europe/Paris',
        },
        all_records_ids_excluded: [],
        smart_action_id: 'comment-Bulk',
        signed_approval_request: null,
      },
      type: 'custom-action-requests',
    },
  },
  state: { user },
});
