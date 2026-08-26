// The `--require` entry point of the Docker image (see the Dockerfile's ENTRYPOINT). Separate from
// `tracing.ts` on purpose: importing the setup must never arm an SDK, only calling it should.
//
// The SDK is handed to `tracing-handle` rather than wired to a signal here. The CLI arms the only
// termination handler, and it flushes through that handle — so a signal arriving before the CLI is
// up cannot be swallowed by a listener that does not terminate anything.
import initTracing from './tracing';
import { setTracingHandle } from './tracing-handle';

setTracingHandle(initTracing());
