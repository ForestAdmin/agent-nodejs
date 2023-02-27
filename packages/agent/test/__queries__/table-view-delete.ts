// This file was created by using the 'Copy as fetch' feature of the Chrome DevTools.

// Do not edit them manually! If the API changes, regenerate them by using Chrome as to ensure
// the queries match the frontend's behavior.

/* eslint-disable max-len */
import { createMockContext } from '@shopify/jest-koa-mocks';

import user from './_user';

export default createMockContext({
  method: 'DELETE',
  url: '/forest/account?timezone=Europe%2FParis',
  requestBody: {
    data: {
      attributes: {
        ids: ['63f88a7b468c3b4d167a18c9'],
        collection_name: 'account',
        parent_collection_name: null,
        parent_collection_id: null,
        parent_association_name: null,
        all_records: false,
        all_records_subset_query: {
          'fields[account]': '_id,address,firstname,lastname,store',
          'fields[address]': '_id',
          'fields[store]': 'name',
          'page[number]': 1,
          'page[size]': 15,
          sort: '-_id',
        },
        all_records_ids_excluded: ['63c5139fe96fe01054007710', '63c51399e96fe01054007700'],
        smart_action_id: null,
        signed_approval_request: null,
      },
      type: 'action-requests',
    },
  },
  state: { user },
});
