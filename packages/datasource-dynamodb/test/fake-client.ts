import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

export type Handler = (input: Record<string, any>, name: string) => unknown;

export type FakeClient = DynamoDBDocumentClient & {
  send: jest.Mock;
  calls: (name?: string) => Array<Record<string, any>>;
};

/** A DocumentClient whose `send` is routed by command name to the given handlers. */
export function fakeClient(handlers: Record<string, Handler | unknown[]>): FakeClient {
  const queues: Record<string, unknown[]> = {};

  const send = jest.fn(async (command: { constructor: { name: string }; input: object }) => {
    const name = command.constructor.name.replace(/Command$/, '');
    const handler = handlers[name];

    if (handler === undefined) throw new Error(`Unexpected command ${name}`);

    if (Array.isArray(handler)) {
      queues[name] ??= [...handler];
      if (queues[name].length === 0) throw new Error(`No more response queued for ${name}`);

      const next = queues[name].length > 1 ? queues[name].shift() : queues[name][0];

      return next instanceof Error ? Promise.reject(next) : next;
    }

    return handler(command.input as Record<string, any>, name);
  });

  const client = { send } as unknown as FakeClient;
  client.calls = (name?: string) =>
    send.mock.calls
      .map(([command]) => command)
      .filter(command => !name || command.constructor.name === `${name}Command`)
      .map(command => command.input);

  return client;
}

export const silentLogger = jest.fn();
