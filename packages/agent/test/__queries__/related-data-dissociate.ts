// This file was created by using the 'Copy as fetch' feature of the Chrome DevTools.

// Do not edit them manually! If the API changes, regenerate them by using Chrome as to ensure
// the queries match the frontend's behavior.

/* eslint-disable max-len */
import { createMockContext } from '@shopify/jest-koa-mocks';

import user from './_user';

export default createMockContext({
  method: 'DELETE',
  url: '/forest/post/96/relationships/comments?timezone=Europe%2FParis',
  requestBody: {
    data: [
      { id: '480', type: 'comment' },
      { id: '479', type: 'comment' },
    ],
  },
  state: { user },
});
