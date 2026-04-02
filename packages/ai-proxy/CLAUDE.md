# @forestadmin/ai-proxy

## Overview

This package is used by both the Forest Admin agent (`@forestadmin/agent`) and the Forest Admin server. Both consumers bind AI error classes to HTTP status codes via their error middleware.

## Error Handling

All errors thrown in this package must extend an AI error class from `src/errors.ts`, never `new Error(...)` directly.

Both the agent and the Forest Admin server map error classes to HTTP status codes. A bare `Error` will result in a generic 500 instead of the correct status.

See `src/errors.ts` for the available error classes.
