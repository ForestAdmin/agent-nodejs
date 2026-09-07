import type BFFHttpServer from '../src/http/bff-http-server';
import type { Logger } from '../src/ports/logger-port';

import { installShutdownHandlers } from '../src/cli-core';

const noopLogger: Logger = () => undefined;

const SIGNALS: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

function serverStub(stop = jest.fn(async () => undefined)) {
  return { server: { stop } as unknown as BFFHttpServer, stop };
}

function installedHandlers(): { signal: NodeJS.Signals; handler: () => void }[] {
  return SIGNALS.map(signal => ({
    signal,
    handler: process.listeners(signal).at(-1) as () => void,
  }));
}

describe('shutdown handlers', () => {
  let installed: { signal: NodeJS.Signals; handler: () => void }[] = [];

  afterEach(() => {
    for (const { signal, handler } of installed) process.removeListener(signal, handler);
    installed = [];
  });

  it.each(SIGNALS)('should stop the server on %s', signal => {
    const { server, stop } = serverStub();

    installShutdownHandlers(server, noopLogger);
    installed = installedHandlers();
    installed.find(entry => entry.signal === signal)?.handler();

    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('should replace the handlers of a previous server instead of adding a pair', () => {
    const first = serverStub();
    const second = serverStub();

    installShutdownHandlers(first.server, noopLogger);
    const before = process.listenerCount('SIGTERM');
    installShutdownHandlers(second.server, noopLogger);
    installed = installedHandlers();

    expect(process.listenerCount('SIGTERM')).toBe(before);

    installed[0].handler();

    expect(first.stop).not.toHaveBeenCalled();
    expect(second.stop).toHaveBeenCalledTimes(1);
  });
});
