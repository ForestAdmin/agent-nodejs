import { createMockContext } from '@shopify/jest-koa-mocks';

export default createMockContext({
  method: 'GET',
  url: '/forest/post?timezone=Europe%2FParis&fields%5Bowner%5D=id&fields%5Bpost%5D=body%2Cid%2Cowner%2Ctitle&page%5Bnumber%5D=1&page%5Bsize%5D=15&sort=-id',
});
