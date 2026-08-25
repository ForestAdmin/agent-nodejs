import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

// Extended once, here, and imported from here by everyone. A schema built from a plain `zod` import
// has no `.openapi()`, so the request schemas and the OpenAPI document must share this instance for
// the same declaration to serve both.
extendZodWithOpenApi(z);

// eslint-disable-next-line import/prefer-default-export
export { z };
