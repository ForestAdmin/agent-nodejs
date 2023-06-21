import net from 'net';
import { Client } from 'ssh2';

import { SshConnectServiceError, SshForwardServiceError } from './errors';
import Service from './service';
import { SshOptions } from '../../types';

export default class SshTunnel extends Service {
  private readonly options: SshOptions;
  private readonly sourceHost: string;
  private readonly sourcePort: number;
  private readonly targetHost: string;
  private readonly targetPort: number;
  private readonly clients = new Set<Client>();

  constructor(
    options: SshOptions,
    sourceHost: string,
    sourcePort: number,
    targetHost: string,
    targetPort: number,
  ) {
    super();
    this.options = options;
    this.sourceHost = sourceHost;
    this.sourcePort = sourcePort;
    this.targetHost = targetHost;
    this.targetPort = targetPort;
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
        client.on('error', e => reject(new SshConnectServiceError(e)));
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
      client.forwardOut(
        this.sourceHost,
        this.sourcePort,
        this.targetHost,
        this.targetPort,
        async (error, stream) => {
          if (error) return reject(new SshForwardServiceError(error));

          this.connectedClients.add(stream);
          stream.on('error', e =>
            this.destroySocketIfUnclosed(stream, new SshForwardServiceError(e)),
          );
          stream.on('close', () => {
            this.destroySocketIfUnclosed(stream);
            this.endClient(client);
          });

          return resolve(await super.connect(stream));
        },
      );
    });
  }

  private endClient(client: Client): void {
    client.end();
    this.clients.delete(client);
  }
}
