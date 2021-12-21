export const routerMockGet = jest.fn();
export const routerMockPost = jest.fn();
export const routerMockPut = jest.fn();
export const routerMockDelete = jest.fn();
export const routerMockUse = jest.fn();

export default jest.fn().mockImplementation(() => ({
  get: routerMockGet,
  post: routerMockPost,
  put: routerMockPut,
  delete: routerMockDelete,
  user: routerMockUse,
}));
