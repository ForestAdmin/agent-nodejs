---
status: accepted
date: 2026-11-03
tags: [agent-bff, oauth, gateway]
affected_components: [agent-bff, gateway]
---

# BFF OAuth sessions travel sealed in the client's tokens, and the Forest server owns refresh safety

The BFF keeps no OAuth session state: the refresh token is the session itself (Forest server refresh token, rendering, user, OAuth client id, 24 h absolute expiry) and the `bff_access` JWT carries the Forest server access token in a `server_access` claim, both sealed with AES-256-GCM under `BFF_TOKEN_ENCRYPTION_KEY`, so any instance holding that key serves any session and a restart loses none (PRD-1886). Every refresh rotates the Forest server refresh token, and idempotent concurrent refreshes, the lost-response retry and grant-wide reuse detection come from the Forest server's Gateway API rotation (PRD-1889, `OAUTH_API_REFRESH_ROTATION_ENABLED`), not from the BFF. Rejected: a shared session store (Redis or a database), because it adds an infrastructure dependency to every customer deployment, which the ticket set as a stop condition; documented sticky sessions, because they lose every session on restart and break behind any load balancer the customer does not control; keeping reuse detection in the BFF, because it is process-local and cannot see a reuse on another instance. Accepted cost: the sealed format is a contract with every client holding a token, so changing it or the key signs everyone out; one key must never be shared between deployments, since sealed tokens carry no audience; revocation reaches an issued `bff_access` token only at its expiry, up to 15 min; and with the server flag off there is no grant-wide reuse detection and concurrent refreshes on two instances fork the grant, which the BFF only reports with a `Warn`.
