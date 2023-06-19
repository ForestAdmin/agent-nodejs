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
    const client = this.newClient();

    try {
      return await new Promise<net.Socket>((resolve, reject) => {
        client.on('error', e => reject(new SshConnectServiceError(e as Error)));
        client.on('ready', async () => {
          try {
            resolve(await this.buildTunnel(client));
          } catch (error) {
            reject(error);
          }
        });

        try {
          // connect to the SSH server
          client.connect({ ...this.options, sock: socket });
        } catch (error) {
          reject(new SshConnectServiceError(error as Error));
        }
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
          if (error) {
            this.endClient(client);

            return reject(new SshForwardServiceError(error as Error));
          }

          this.connectedClients.add(stream);
          stream.on('error', e =>
            this.destroySocketIfUnclosed(stream, new SshForwardServiceError(e as Error)),
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

  private newClient(): Client {
    const client = new Client();
    this.clients.add(client);

    return client;
  }

  private endClient(client: Client): void {
    client.end();
    this.clients.delete(client);
  }
}
