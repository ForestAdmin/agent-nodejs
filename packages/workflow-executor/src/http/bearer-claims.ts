import { z } from 'zod';

// Claims we require from the decoded bearer JWT payload (ctx.state.user). Non-strict on purpose:
// jsonwebtoken adds standard claims (iat/exp) and Forest may send extra ones — strict would reject
// every real token. Only `id` is consumed downstream (handleTrigger + hasRunAccess → ?userId=).
// `z.coerce` because Forest sends the user id as a numeric string ("245"); coercing then validating
// integer/positive preserves the previous `Number(rawId)` + `Number.isFinite` behavior and rejects
// null/empty (→ 0) and non-numeric ids.
export const BearerClaimsSchema = z.object({ id: z.coerce.number().int().positive() });

export type BearerClaims = z.infer<typeof BearerClaimsSchema>;
