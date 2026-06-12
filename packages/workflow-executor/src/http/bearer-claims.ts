import { z } from 'zod';

// Claims we require from the decoded bearer JWT payload (ctx.state.user). Non-strict on purpose:
// jsonwebtoken adds standard claims (iat/exp) and Forest may send extra ones — strict would reject
// every real token. Only `id` is consumed downstream (handleTrigger + hasRunAccess → ?userId=).
// `.int()` rejects NaN/Infinity/floats (a user id is an integer) — preserves the invariant the
// previous Number.isFinite guard enforced.
export const BearerClaimsSchema = z.object({ id: z.number().int() });

export type BearerClaims = z.infer<typeof BearerClaimsSchema>;
