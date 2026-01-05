import type { SshOptions } from '../../types';
import type net from 'net';

import { Client } from 'ssh2';

import Service from './service';
import { SshConnectError, SshForwardError } from '../errors';

export default class SshTunnel extends Service {
  private readonly options: SshOptions;
  private readonly clients = new Set<Client>();

  constructor(options: SshOptions, targetHost: string, targetPort: number) {
    super(options.host, options.port, targetHost, targetPort);
    this.options = options;
  }

  override async stop(): Promise<void> {
    try {
      await super.stop();
    } finally {
      this.clients.forEach(client => this.endClient(client));
    }
  }

  override async connect(socket?: net.Socket): Promise<net.Socket> {
    const client = new Client();
    // list all the clients to be able to close them all when the service is stopped
    this.clients.add(client);

    try {
      return await new Promise<net.Socket>((resolve, reject) => {
        client.on('error', e => reject(new SshConnectError(e.message, this.debugUri)));
        client.on('ready', async () => {
          try {
            resolve(await this.buildTunnel(client));
          } catch (error) {
            reject(error);
          }
        });

        // connect to the SSH server
        // will trigger the 'ready' event if the connection is successful
        // if the connection fails, the 'error' event will be triggered
        client.connect({ ...this.options, sock: socket });
      });
    } catch (error) {
      this.endClient(client);
      this.errors.push(error);
      throw error;
    }
  }

  private async buildTunnel(client): Promise<net.Socket> {
    // tell to the SSH server to forward all the traffic to the target host and port
    return new Promise<net.Socket>((resolve, reject) => {
      // source host and port are not used by the SSH server
      client.forwardOut('', 0, this.targetHost, this.targetPort, async (error, stream) => {
        if (error) return reject(new SshForwardError(error.message, this.debugForwardUri));

        this.addConnectedClient(stream);
        stream.on('error', e =>
          this.destroySocketIfUnclosedAndSaveError(
            stream,
            new SshConnectError(e.message, this.debugUri),
          ),
        );
        stream.on('close', () => {
          this.destroySocketIfUnclosedAndSaveError(stream);
          this.endClient(client);
        });

        return resolve(await super.connect(stream));
      });
    });
  }

  private endClient(client: Client): void {
    client.end();
    this.clients.delete(client);
  }
}
