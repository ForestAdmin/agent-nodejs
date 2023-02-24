import { createMockContext } from '@shopify/jest-koa-mocks';

export default createMockContext({
  method: 'DELETE',
  url: '/forest/rental?timezone=Europe%2FParis',
  requestBody: {
    data: {
      attributes: {
        ids: ['33', '21'],
        collection_name: 'rental',
        parent_collection_name: null,
        parent_collection_id: null,
        parent_association_name: null,
        all_records: true,
        all_records_subset_query: {
          'fields[rental]': 'customer,id,numberOfDays',
          'fields[customer]': 'name',
          'page[number]': 1,
          'page[size]': 15,
          segment: 'More than 50 Days',
          sort: '-id',
          search: 'larkin',
          searchExtended: 1,
          isSearchExtended: true,
        },
        all_records_ids_excluded: [],
        smart_action_id: null,
        signed_approval_request: null,
      },
      type: 'action-requests',
    },
  },
});
