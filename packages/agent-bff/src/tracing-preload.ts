// The `--require` entry point of the Docker image (see the Dockerfile's ENTRYPOINT). Separate from
// `tracing.ts` on purpose: importing the setup must never arm an SDK, only calling it should.
import initTracing from './tracing';

initTracing();
