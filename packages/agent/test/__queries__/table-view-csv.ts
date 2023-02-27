// This file was created by using the 'Copy as fetch' feature of the Chrome DevTools.

// Do not edit them manually! If the API changes, regenerate them by using Chrome as to ensure
// the queries match the frontend's behavior.

/* eslint-disable max-len */
import { createMockContext } from '@shopify/jest-koa-mocks';

import user from './_user';

export default createMockContext({
  method: 'GET',
  url: '/forest/comment.csv?fields%5Bcomment%5D=body%2Cemail%2Cid%2Cname%2Cpost&fields%5Bpost%5D=id&page%5Bnumber%5D=1&page%5Bsize%5D=15&sort=-id&filename=comments&header=body%2Cemail%2Cid%2Cname%2Cpost&sessionToken=&timezone=Europe%2FParis',
  state: { user },
});
