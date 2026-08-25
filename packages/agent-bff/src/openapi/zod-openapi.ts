// Kept as the openapi module's entry point for zod; the extension itself lives in `src/zod.ts` so
// the request schemas can share the same extended instance without depending on this folder.
// eslint-disable-next-line import/prefer-default-export
export { z } from '../zod';
